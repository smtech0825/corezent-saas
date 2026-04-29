/**
 * POST /api/license/reset
 *
 * Request:  { key: string, hwid?: string, product?: 'geniepost' | 'geniestock' }
 * Response: { success: boolean, error?: string }
 *
 * 분기:
 *   - product === 'geniestock'  → Supabase에서 키의 모든 HWID 삭제
 *   - 그 외 (없음 or 'geniepost') → 기존 Google Sheets 초기화 (변경 없음)
 *
 * 보안: HWID 대조하지 않음 (오프라인 PC 교체 지원). 남용 방지는 호출 측 책임.
 */

import { NextRequest, NextResponse } from 'next/server'
import { findByKey, patchCell, isStopped } from '../_lib'
import {
  findLicenseByKey as supaFindLicenseByKey,
  resetHwidsForKey as supaResetHwidsForKey,
} from '../_lib_supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const key     = (body?.key     as string | undefined)?.trim()
    const product = (body?.product as string | undefined)?.trim().toLowerCase()

    if (!key) {
      return NextResponse.json(
        { success: false, error: '키가 누락됐어요.' },
        { status: 400 },
      )
    }

    // ─── GenieStock 경로 (Supabase) ──────────────────────────────────────
    if (product === 'geniestock') {
      return await resetGenieStock(key)
    }

    // ─── 기존 GeniePost 경로 (Google Sheets) — 절대 수정 금지 ────────────
    const row = await findByKey(key)

    if (!row) {
      return NextResponse.json(
        { success: false, error: '등록되지 않은 라이선스 키예요.' },
        { status: 404 },
      )
    }

    if (isStopped(row.status)) {
      return NextResponse.json({
        success: false,
        error: '사용이 중지된 라이선스 키는 초기화할 수 없어요.',
      })
    }

    // HWID 초기화 + 상태 ready
    await Promise.all([
      patchCell(row.rowNum, 'C', ''),
      patchCell(row.rowNum, 'F', 'ready'),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[License/reset]', err)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  }
}

// ─── GenieStock 초기화 (Supabase) ──────────────────────────────────────────

async function resetGenieStock(key: string) {
  const license = await supaFindLicenseByKey(key)
  if (!license) {
    return NextResponse.json({
      success: false,
      error: '등록되지 않은 라이선스 키예요.',
    }, { status: 404 })
  }

  if (!license.isActive) {
    return NextResponse.json({
      success: false,
      error: '사용이 중지된 라이선스 키는 초기화할 수 없어요.',
    })
  }

  await supaResetHwidsForKey(key)
  return NextResponse.json({ success: true })
}
