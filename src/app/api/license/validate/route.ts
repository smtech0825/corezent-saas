/**
 * POST /api/license/validate
 *
 * Request:  { key: string, hwid: string, product?: 'geniepost' | 'geniestock' }
 * Response: { valid, tier?, expiresAt?, remainingDays?, error?, errorCode? }
 *
 * 분기:
 *   - product === 'geniestock'  → Supabase 기반 검증 (티어별 다중 PC 지원)
 *   - 그 외 (없음 or 'geniepost') → 기존 Google Sheets 검증 (변경 없음)
 *
 * 응답 shape는 두 경로 모두 동일하므로 앱 코드 변경 불필요.
 */

import { NextRequest, NextResponse } from 'next/server'
import { findByKey, patchCell, isStopped, isExpired, calcRemainingDays } from '../_lib'
import {
  findLicenseByKey as supaFindLicenseByKey,
  getHwidsForKey as supaGetHwidsForKey,
  registerHwid as supaRegisterHwid,
  isExpired as supaIsExpired,
  calcRemainingDays as supaCalcRemainingDays,
} from '../_lib_supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const key     = (body?.key     as string | undefined)?.trim()
    const hwid    = (body?.hwid    as string | undefined)?.trim()
    const product = (body?.product as string | undefined)?.trim().toLowerCase()

    if (!key || !hwid) {
      return NextResponse.json(
        { valid: false, error: '키 또는 HWID가 누락됐어요.' },
        { status: 400 },
      )
    }

    // ─── GenieStock 경로 (Supabase) ──────────────────────────────────────
    if (product === 'geniestock') {
      return await validateGenieStock(key, hwid)
    }

    // ─── 기존 GeniePost 경로 (Google Sheets) — 절대 수정 금지 ────────────
    const row = await findByKey(key)

    if (!row) {
      return NextResponse.json(
        { valid: false, error: '등록되지 않은 라이선스 키예요.', errorCode: 'NOT_FOUND' },
        { status: 404 },
      )
    }

    if (isStopped(row.status)) {
      return NextResponse.json({
        valid: false,
        error: '사용이 중지된 라이선스 키예요. 고객센터에 문의해주세요.',
        errorCode: 'STOPPED',
      })
    }

    if (isExpired(row.status, row.expiresAt)) {
      return NextResponse.json({
        valid: false,
        error: '만료된 라이선스 키예요. 갱신 후 다시 시도해주세요.',
        errorCode: 'EXPIRED',
      })
    }

    // ── HWID 확인 ────────────────────────────────────────────────────────────
    if (!row.hwid) {
      // 첫 활성화 — HWID 바인딩 + 상태 active
      await Promise.all([
        patchCell(row.rowNum, 'C', hwid),
        patchCell(row.rowNum, 'F', 'active'),
      ])
    } else if (row.hwid !== hwid) {
      return NextResponse.json({
        valid: false,
        error: '다른 PC에서 이미 인증된 키예요. PC 초기화가 필요하면 설정에서 요청해주세요.',
        errorCode: 'HWID_MISMATCH',
      })
    }

    return NextResponse.json({
      valid: true,
      tier: row.tier,
      expiresAt:     row.expiresAt ? new Date(row.expiresAt).toISOString() : undefined,
      remainingDays: calcRemainingDays(row.expiresAt),
    })
  } catch (err) {
    console.error('[License/validate]', err)
    return NextResponse.json(
      { valid: false, error: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  }
}

// ─── GenieStock 검증 (Supabase) ────────────────────────────────────────────

async function validateGenieStock(key: string, hwid: string) {
  // 1. 라이선스 조회
  const license = await supaFindLicenseByKey(key)
  if (!license) {
    return NextResponse.json({
      valid: false,
      error: '등록되지 않은 라이선스 키예요.',
      errorCode: 'NOT_FOUND',
    }, { status: 404 })
  }

  // 2. 활성 여부
  if (!license.isActive) {
    return NextResponse.json({
      valid: false,
      error: '사용이 중지된 라이선스 키예요. 고객센터에 문의해주세요.',
      errorCode: 'STOPPED',
    })
  }

  // 3. 만료 여부
  if (supaIsExpired(license)) {
    return NextResponse.json({
      valid: false,
      error: '만료된 라이선스 키예요. 갱신 후 다시 시도해주세요.',
      errorCode: 'EXPIRED',
    })
  }

  // 4. HWID 검사 (이미 등록된 기기는 통과, 신규는 한도 내 등록)
  const hwids = await supaGetHwidsForKey(key)
  const alreadyRegistered = hwids.some((h) => h.hwid === hwid)

  if (!alreadyRegistered) {
    const result = await supaRegisterHwid(key, hwid)
    if (!result.ok) {
      return NextResponse.json({
        valid: false,
        error: '다른 PC에서 이미 인증된 키예요. PC 변경이 필요하면 사용 PC 변경을 진행해주세요.',
        errorCode: 'HWID_MISMATCH',
      })
    }
  }

  // 5. 성공
  return NextResponse.json({
    valid: true,
    tier: license.tier,
    expiresAt:     license.expiresAt ? new Date(license.expiresAt).toISOString() : undefined,
    remainingDays: supaCalcRemainingDays(license.expiresAt),
  })
}
