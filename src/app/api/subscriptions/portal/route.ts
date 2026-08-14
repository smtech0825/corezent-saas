/**
 * @파일: api/subscriptions/portal/route.ts
 * @설명: 결제사(Lemon Squeezy) 결제수단 변경 화면 주소 발급 API.
 *        소유권 검증 후 LS API에서 구독을 조회해 update_payment_method 서명 주소를 돌려준다.
 *        ★ 고객 포털 전체(customer_portal)가 아니라 결제수단 변경 전용 화면만 연다 —
 *        포털에서는 요금제 변경이 가능한데 우리 웹훅이 플랜 변경을 반영하지 못해
 *        결제사와 상태가 어긋난다(플랜 변경은 별도 라운드).
 *        ★ 서명 주소는 24시간만 유효하므로 DB에 저장된 값을 쓰지 않고 누를 때마다 새로 발급한다.
 *        결제사 상태를 바꾸는 호출이 아니라 조회(GET)뿐이다 — 금액 계산·상태 변경·DB 쓰기 없음.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { LSSubscriptionAttributes } from '@/lib/lemonsqueezy'

/**
 * @함수명: POST
 * @설명: 로그인 사용자의 구독인지 확인한 뒤 결제수단 변경 화면의 새 서명 주소를 반환합니다.
 *        조회는 쿠키 기반 클라이언트(RLS — 본인 구독만 보임)로 하고, 소유권 비교를
 *        한 번 더 해 이중 방어합니다. 실패 사유는 취소 라우트와 같은 code 방식으로 구분합니다.
 * @매개변수: request - { subscriptionId } JSON 본문
 * @반환값: { ok, url } 또는 { error, code } JSON 응답
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { subscriptionId } = (await request.json()) as { subscriptionId?: string }

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Invalid payload', code: 'INVALID_PAYLOAD' }, { status: 400 })
    }

    // 1. 현재 로그인 사용자 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    // 2. 구독 조회 — 쿠키 기반 클라이언트(RLS 적용: 본인 구독만 조회됨).
    //    남의 구독 id를 넣으면 0행이라 NOT_FOUND로 떨어진다. user_id 비교는 이중 방어.
    const { data: subscription, error: fetchErr } = await supabase
      .from('subscriptions')
      .select('id, user_id, lemon_squeezy_subscription_id')
      .eq('id', subscriptionId)
      .single()

    if (fetchErr || !subscription) {
      return NextResponse.json({ error: 'Subscription not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (subscription.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    // LS 구독 ID가 없는 구독(테스트/수동 데이터)은 결제사에 관리 화면 실체가 없다.
    const lsSubId = subscription.lemon_squeezy_subscription_id
    if (!lsSubId) {
      return NextResponse.json({ error: 'No Lemon Squeezy subscription', code: 'NO_LS_SUBSCRIPTION' }, { status: 400 })
    }

    // 3. LS API 조회 — 매 호출마다 새 서명 주소가 내려온다(저장 금지·재사용 금지)
    const apiKey = process.env.LEMONSQUEEZY_API_KEY
    if (!apiKey) {
      throw new Error('LEMONSQUEEZY_API_KEY is not configured')
    }

    const lsRes = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${lsSubId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      // 서명 주소는 매번 새로 받아야 한다 — 어떤 계층의 캐시도 금지
      cache: 'no-store',
    })

    if (!lsRes.ok) {
      const body = await lsRes.text()
      console.error('[subscriptions/portal] Lemon Squeezy API error:', lsRes.status, body)
      // 404 = LS에 해당 구독이 없음(모드 불일치·삭제됨) — 열 화면이 없다
      if (lsRes.status === 404) {
        return NextResponse.json({ error: 'Subscription not found on Lemon Squeezy', code: 'LS_NOT_FOUND' }, { status: 404 })
      }
      return NextResponse.json({ error: `Lemon Squeezy API error: ${lsRes.status}`, code: 'LS_API_ERROR' }, { status: 502 })
    }

    const lsJson = (await lsRes.json()) as { data?: { attributes?: LSSubscriptionAttributes } }
    // ★ update_payment_method만 반환 — customer_portal 폴백을 두면 요금제 변경 경로가 다시 열린다
    const paymentUrl = lsJson.data?.attributes?.urls?.update_payment_method

    if (!paymentUrl) {
      console.error('[subscriptions/portal] 응답에 update_payment_method 주소 없음:', lsSubId)
      return NextResponse.json({ error: 'No payment URL in response', code: 'LS_NO_PORTAL' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, url: paymentUrl })
  } catch (err) {
    console.error('[subscriptions/portal]', err)
    return NextResponse.json({ error: 'Failed to get portal URL', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
