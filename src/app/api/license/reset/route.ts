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
import { logLicenseReset, type LicenseResetProduct } from '@/lib/licenseResetLog'

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

    // 모니터링 로그 — 성공/거부 여부와 무관하게 호출될 때마다 기록(로그인/소유권 검증 아님).
    const normalizedProduct: LicenseResetProduct =
      product === 'geniestock' || product === 'geniework' ? product : 'geniepost'
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    await logLicenseReset({ licenseKey: key, product: normalizedProduct, ip })

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

  // ── GenieWork: 원자적 RPC(직렬화 + 분당 rate limit + 주기 제한 + 이력 보존) ──
  if (product === 'geniework') {
    const r = await supaResetHwidsForKeyGenieWork(key)
    if (!r.ok) {
      // 분당 버스트(Wave 1) 또는 주기 한도(Wave 2) 초과 → 429
      if (r.reason === 'RATE_LIMITED' || r.reason === 'RESET_PERIOD_LIMITED') {
        const payload: Record<string, unknown> = {
          success: false,
          // nextAllowedAt(주기 한도)이 있으면 날짜를 안내, 없으면(분당 버스트) 일반 안내
          error: r.nextAllowedAt
            ? `PC 변경 가능 횟수를 초과했어요. ${r.nextAllowedAt.slice(0, 10)} 이후 다시 시도해주세요.`
            : 'PC 변경 요청이 너무 잦아요. 잠시 후 다시 시도해주세요.',
          errorCode: 'RESET_RATE_LIMITED',
        }
        if (r.nextAllowedAt) payload.nextAllowedAt = r.nextAllowedAt
        return NextResponse.json(payload, { status: 429 })
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
