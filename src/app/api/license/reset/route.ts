/**
 * POST /api/license/reset
 *
 * Request:  { key: string, hwid: string }
 * Response: { success: boolean, error?: string }
 *
 * 로직:
 *   1. Google Sheets B열에서 key 검색
 *   2. C열(HWID) 초기화 → ''
 *   3. E열(상태)  → 'ready'
 *   4. D열(만료일) 유지
 *
 * 참고: 보안상 현재 바인딩된 HWID 를 body.hwid 와 대조하지 않음.
 *       완전 오프라인 PC 교체 시나리오를 지원하기 위함.
 *       남용 방지가 필요하면 호출 측(앱)에서 횟수 제한 로직 추가.
 */

import { NextRequest, NextResponse } from 'next/server'
import { findByKey, patchCell, isStopped } from '../_lib'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const key  = (body?.key as string | undefined)?.trim()

    if (!key) {
      return NextResponse.json(
        { success: false, error: '키가 누락됐어요.' },
        { status: 400 },
      )
    }

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
