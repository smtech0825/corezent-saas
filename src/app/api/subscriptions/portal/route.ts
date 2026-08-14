/**
 * @파일: api/subscriptions/portal/route.ts
 * @설명: 결제사(Lemon Squeezy) 고객 관리 화면 주소 발급 API.
 *        소유권 검증 후 LS API에서 구독을 조회해 customer_portal 서명 주소를 돌려준다.
 *        ★ 서명 주소는 24시간만 유효하므로 DB에 저장된 값(customer_portal_url)을 쓰지 않고
 *        누를 때마다 새로 발급한다. 실패 사유는 취소 라우트와 같은 방식의 code로 구분한다.
 *        결제사 쪽 상태를 바꾸는 호출이 아니라 조회(GET)뿐이다 — 금액 계산·상태 변경 없음.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { LSSubscriptionAttributes } from '@/lib/lemonsqueezy'

export async function POST(request: Request) {
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

    // 2. 구독 소유권 검증 (취소 라우트와 동일 관례)
    const adminClient = createAdminClient()
    const { data: subscription, error: fetchErr } = await adminClient
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
    const portalUrl = lsJson.data?.attributes?.urls?.customer_portal

    if (!portalUrl) {
      console.error('[subscriptions/portal] 응답에 customer_portal 주소 없음:', lsSubId)
      return NextResponse.json({ error: 'No portal URL in response', code: 'LS_NO_PORTAL' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, url: portalUrl })
  } catch (err) {
    console.error('[subscriptions/portal]', err)
    return NextResponse.json({ error: 'Failed to get portal URL', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
