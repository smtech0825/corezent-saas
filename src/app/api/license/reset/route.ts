/**
 * POST /api/license/reset
 *
 * Request:  { key: string, hwid?: string, product?: 'geniepost' | 'geniestock' | 'geniework' }
 * Response: { success: boolean, error?: string }
 *
 * 분기:
 *   - product === 'geniestock' | 'geniework' → Supabase에서 키의 모든 HWID 삭제
 *   - 그 외 (없음 or 'geniepost') → 기존 Google Sheets 초기화 (변경 없음)
 *
 * 보안: HWID 대조하지 않음 (오프라인 PC 교체 지원). 남용 방지는 호출 측 책임.
 */

import { NextRequest, NextResponse } from 'next/server'
import { findByKey, patchCell, isStopped } from '../_lib'
import {
  findLicenseByKey as supaFindLicenseByKey,
  resetHwidsForKey as supaResetHwidsForKey,
  resetHwidsForKeyGenieWork as supaResetHwidsForKeyGenieWork,
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

    // ─── Supabase 경로 (GenieStock / GenieWork) ──────────────────────────
    if (product === 'geniestock' || product === 'geniework') {
      return await resetSupabase(key, product)
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

// ─── Supabase 초기화 (GenieStock / GenieWork 공용) ─────────────────────────

async function resetSupabase(key: string, product: 'geniestock' | 'geniework') {
  const license = await supaFindLicenseByKey(key, product)
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

  // ── GenieWork: 원자적 RPC(직렬화 + 분당 reset rate limit + 이력 보존) ──
  if (product === 'geniework') {
    const r = await supaResetHwidsForKeyGenieWork(key)
    if (!r.ok) {
      if (r.reason === 'RATE_LIMITED') {
        return NextResponse.json({
          success: false,
          error: 'PC 변경 요청이 너무 잦아요. 잠시 후 다시 시도해주세요.',
          errorCode: 'RESET_RATE_LIMITED',
        }, { status: 429 })
      }
      // NO_CONFIG 등 예기치 못한 사유 — fail-closed
      console.error(`[License/reset] 초기화 거부(예상 외 사유): ${r.reason}`)
      return NextResponse.json({
        success: false,
        error: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
      }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // ── GenieStock(기존) — 전체 삭제. 변경 없음. ──
  await supaResetHwidsForKey(key, product)
  return NextResponse.json({ success: true })
}
