/**
 * @파일: api/cron/tax-law-watch/route.ts
 * @설명: 법령 개정 자동 감시 배치 — Vercel Cron이 하루 한 번 호출한다.
 *
 *        인증: Vercel Cron은 `Authorization: Bearer <CRON_SECRET>` 헤더를 붙여 부른다.
 *        CRON_SECRET이 없으면 아예 거부한다 — 설정을 빠뜨린 채로 열려 있는 것이
 *        가장 위험하기 때문이다(공개 주소에서 외부가 배치를 돌릴 수 있다).
 *
 *        결과는 JSON으로 돌려준다. 실패해도 500을 던지지 않고 200 + ok:false로
 *        내보낸다 — Cron 로그보다 tax_law_watch_state와 관리자 화면이 단일 출처이고,
 *        재시도로 같은 날짜를 여러 번 두드리는 것을 피하기 위해서다.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runLawWatch } from '@/lib/tax/law-watch'

/** 외부 API를 여러 번 호출하므로 기본값보다 넉넉히 둔다(로직에도 자체 시간 상한이 있다) */
export const maxDuration = 60

/** 항상 그 시점의 DB·외부 API를 본다 — 캐시 금지 */
export const dynamic = 'force-dynamic'

/**
 * @함수명: isAuthorized
 * @설명: Vercel Cron이 보낸 요청인지 확인합니다. CRON_SECRET 미설정은 거부입니다.
 * @매개변수: request - 들어온 요청
 * @반환값: 허용 여부
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.trim() === '') return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    // 존재 여부를 흘리지 않도록 사유를 자세히 적지 않는다
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const result = await runLawWatch(supabase)
    return NextResponse.json(result)
  } catch (e) {
    // runLawWatch는 대부분의 실패를 결과 객체로 돌려주지만, 상태 저장 자체가
    // 실패하는 경우가 있어 마지막 그물을 둔다
    const message = e instanceof Error ? e.message : String(e)
    console.error('[tax-law-watch] 배치 실행 중 처리하지 못한 오류:', message)
    return NextResponse.json({ ok: false, message }, { status: 200 })
  }
}
