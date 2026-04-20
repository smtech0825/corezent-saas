/**
 * POST /api/license/upgrade
 *
 * Request:  { key: string, hwid: string }
 * Response: ApiUpgradeResult
 *   { success, tier?, oldExpiresAt?, newExpiresAt?, error? }
 *
 * 로직:
 *   1. Google Sheets B열에서 새 key 검색
 *   2. 중지 / 만료 키 차단
 *   3. HWID 불일치 차단 (이미 다른 PC에 바인딩된 경우)
 *   4. HWID 미바인딩 → 바인딩 + 상태 active
 *   5. 새 티어·만료일 반환
 *
 * 사용 시나리오:
 *   - 기존 Lite 키 사용 중 Pro 키를 추가 구매한 사용자가
 *     설정 화면에서 새 키를 입력하는 경우.
 *   - 이 엔드포인트는 새 키의 유효성만 검증하며,
 *     이전 키의 무효화는 클라이언트(앱) 또는 어드민이 별도로 처리.
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
        { success: false, error: '키 또는 HWID가 누락됐어요.' },
        { status: 400 },
      )
    }

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
