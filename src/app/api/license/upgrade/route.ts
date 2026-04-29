/**
 * POST /api/license/upgrade
 *
 * Request:  { key: string, hwid: string, product?: 'geniepost' | 'geniestock' }
 * Response: { success, tier?, newExpiresAt?, remainingDays?, error? }
 *
 * 분기:
 *   - product === 'geniestock'  → Supabase 기반 검증 (validate와 동일 로직)
 *   - 그 외 (없음 or 'geniepost') → 기존 Google Sheets 검증 (변경 없음)
 *
 * 사용 시나리오: Lite 키 사용 중 Pro 키를 추가 구매한 사용자가
 *               설정 화면에서 새 키를 입력하는 경우. 새 키의 유효성만 검증하며,
 *               이전 키의 무효화는 클라이언트(앱) 또는 어드민이 별도 처리.
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
        { success: false, error: '키 또는 HWID가 누락됐어요.' },
        { status: 400 },
      )
    }

    // ─── GenieStock 경로 (Supabase) ──────────────────────────────────────
    if (product === 'geniestock') {
      return await upgradeGenieStock(key, hwid)
    }

    // ─── 기존 GeniePost 경로 (Google Sheets) — 절대 수정 금지 ────────────
    const row = await findByKey(key)

    if (!row) {
      return NextResponse.json({
        success: false,
        error: '등록되지 않은 라이선스 키예요.',
      })
    }

    if (isStopped(row.status)) {
      return NextResponse.json({
        success: false,
        error: '사용이 중지된 라이선스 키예요.',
      })
    }

    if (isExpired(row.status, row.expiresAt)) {
      return NextResponse.json({
        success: false,
        error: '만료된 라이선스 키예요. 갱신 후 다시 시도해주세요.',
      })
    }

    // HWID 이미 다른 PC에 바인딩된 경우 차단
    if (row.hwid && row.hwid !== hwid) {
      return NextResponse.json({
        success: false,
        error: '이 키는 다른 PC에서 이미 사용 중이에요.',
      })
    }

    // 미바인딩 → 첫 활성화
    if (!row.hwid) {
      await Promise.all([
        patchCell(row.rowNum, 'C', hwid),
        patchCell(row.rowNum, 'F', 'active'),
      ])
    }

    const newExpiresAt = row.expiresAt ? new Date(row.expiresAt).toISOString() : undefined

    return NextResponse.json({
      success:       true,
      tier:          row.tier,
      newExpiresAt,
      remainingDays: calcRemainingDays(row.expiresAt),
    })
  } catch (err) {
    console.error('[License/upgrade]', err)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  }
}

// ─── GenieStock 업그레이드 (Supabase) ──────────────────────────────────────
// validate와 동일 로직: 키 검증 + HWID 미등록 시 한도 내 등록

async function upgradeGenieStock(key: string, hwid: string) {
  const license = await supaFindLicenseByKey(key)
  if (!license) {
    return NextResponse.json({
      success: false,
      error: '등록되지 않은 라이선스 키예요.',
    })
  }

  if (!license.isActive) {
    return NextResponse.json({
      success: false,
      error: '사용이 중지된 라이선스 키예요.',
    })
  }

  if (supaIsExpired(license)) {
    return NextResponse.json({
      success: false,
      error: '만료된 라이선스 키예요. 갱신 후 다시 시도해주세요.',
    })
  }

  // HWID 검사 + 한도 내 등록
  const hwids = await supaGetHwidsForKey(key)
  const alreadyRegistered = hwids.some((h) => h.hwid === hwid)

  if (!alreadyRegistered) {
    const result = await supaRegisterHwid(key, hwid)
    if (!result.ok) {
      return NextResponse.json({
        success: false,
        error: '이 키는 다른 PC에서 이미 사용 중이에요.',
      })
    }
  }

  const newExpiresAt = license.expiresAt ? new Date(license.expiresAt).toISOString() : undefined

  return NextResponse.json({
    success:       true,
    tier:          license.tier,
    newExpiresAt,
    remainingDays: supaCalcRemainingDays(license.expiresAt),
  })
}
