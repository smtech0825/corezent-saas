/**
 * POST /api/license/validate
 *
 * Request:  { key: string, hwid: string }
 * Response: ApiValidateResult
 *   { valid, tier?, expiresAt?, remainingDays?, error?, errorCode? }
 *
 * 로직:
 *   1. Google Sheets B열에서 key 검색
 *   2. 중지(stopped) → STOPPED
 *   3. 만료(expired 또는 날짜 초과) → EXPIRED
 *   4. HWID 비어있음 → 첫 활성화: C열에 HWID 기록 + E열 'active'
 *   5. HWID 일치 → 정상 반환
 *   6. HWID 불일치 → HWID_MISMATCH
 */

import { NextRequest, NextResponse } from 'next/server'
import { findByKey, patchCell, isStopped, isExpired, calcRemainingDays } from '../_lib'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const key  = (body?.key  as string | undefined)?.trim()
    const hwid = (body?.hwid as string | undefined)?.trim()

    if (!key || !hwid) {
      return NextResponse.json(
        { valid: false, error: '키 또는 HWID가 누락됐어요.' },
        { status: 400 },
      )
    }

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
