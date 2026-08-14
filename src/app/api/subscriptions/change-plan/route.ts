/**
 * @파일: api/subscriptions/change-plan/route.ts
 * @설명: 플랜 올리기 요청 API — 소유권 검증 후 결제사(Lemon Squeezy)에 구독의
 *        variant 변경을 요청한다(PATCH). 정산·청구는 전부 결제사가 처리한다 —
 *        이 라우트에 금액 계산은 없다(청구 옵션도 지정하지 않아 결제사 기본 정산).
 *        ★ 우리 DB는 여기서 바꾸지 않는다 — 결제사 통지(subscription_updated 웹훅)가
 *        도착하면 웹훅의 플랜 변경 갈래가 옵션행·라이선스 대수를 따라 바꾼다.
 *        ★ 올리기만 허용 — 새 옵션의 PC 한도가 현재보다 커야 한다(서버 재검증,
 *        판정은 기존 hwidLimitForTier 재사용 — 대수 비교일 뿐 금액 계산이 아니다).
 *        실패 사유는 취소·결제수단 라우트와 같은 code 방식으로 구분한다.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hwidLimitForTier, isKnownTier } from '@/app/api/license/_lib_supabase'
import { logNotification } from '@/lib/notification-log'
import { maskSecretsInText } from '@/lib/mask'

/**
 * @함수명: POST
 * @설명: 로그인 사용자의 구독인지 확인하고, 요청한 상위 옵션으로의 변경을 결제사에
 *        요청합니다. 같은 옵션으로의 중복 요청은 ALREADY_ON_PLAN으로 거릅니다
 *        (두 번 눌러도 결제사에 한 번만 의미 있는 요청이 가게 하는 서버 쪽 잠금).
 * @매개변수: request - { subscriptionId, newPriceId } JSON 본문
 * @반환값: { ok } 또는 { error, code } JSON 응답
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { subscriptionId, newPriceId } = (await request.json()) as {
      subscriptionId?: string
      newPriceId?: string
    }
    if (!subscriptionId || !newPriceId) {
      return NextResponse.json({ error: 'Invalid payload', code: 'INVALID_PAYLOAD' }, { status: 400 })
    }

    // 1. 로그인 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    // 2. 구독 조회(RLS — 본인 것만 보임) + 소유권 이중 확인
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, user_id, status, cancel_at_period_end, product_price_id, lemon_squeezy_subscription_id')
      .eq('id', subscriptionId)
      .single()
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (subscription.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }
    // 활성 구독만 — 취소 예약·해지·만료 구독의 플랜 변경은 결제사도 의미가 없다
    if (subscription.status !== 'active' || subscription.cancel_at_period_end === true) {
      return NextResponse.json({ error: 'Subscription is not active', code: 'NOT_ACTIVE' }, { status: 400 })
    }
    const lsSubId = subscription.lemon_squeezy_subscription_id
    if (!lsSubId) {
      return NextResponse.json({ error: 'No Lemon Squeezy subscription', code: 'NO_LS_SUBSCRIPTION' }, { status: 400 })
    }
    if (!subscription.product_price_id) {
      // 옵션행이 연결되지 않은 구독(번들·레거시)은 무엇에서 무엇으로 바꾸는지 판정 불가
      return NextResponse.json({ error: 'Plan option not found', code: 'PLAN_NOT_FOUND' }, { status: 404 })
    }

    // 3. 현재·새 옵션행 조회(가격표는 공개 조회 대상) — 서버에서 다시 검증한다
    const { data: currentPP } = await supabase
      .from('product_prices')
      .select('id, product_id, license_tier, interval, type, lemon_squeezy_variant_id')
      .eq('id', subscription.product_price_id)
      .maybeSingle()
    const { data: newPP } = await supabase
      .from('product_prices')
      .select('id, product_id, license_tier, interval, type, lemon_squeezy_variant_id, is_active')
      .eq('id', newPriceId)
      .maybeSingle()

    if (!currentPP || !newPP || newPP.is_active !== true) {
      return NextResponse.json({ error: 'Plan option not found', code: 'PLAN_NOT_FOUND' }, { status: 404 })
    }
    // 같은 상품 안에서만 — 다른 상품으로의 변경은 이 경로가 아니다
    if (newPP.product_id !== currentPP.product_id) {
      return NextResponse.json({ error: 'Different product', code: 'DIFFERENT_PRODUCT' }, { status: 400 })
    }
    // 구독형 옵션 + 같은 결제 주기 안에서만 — 라벨이 아니라 정본 컬럼(type·interval)으로
    // 비교한다(라벨은 자유 텍스트 — 검증 지적). 월↔연 전환·구매형 옵션은 이번 범위 밖.
    if (newPP.type !== 'subscription' || newPP.interval !== currentPP.interval) {
      return NextResponse.json({ error: 'Different billing cycle', code: 'DIFFERENT_CYCLE' }, { status: 400 })
    }
    // 중복 요청(두 번 누름) — 이미 그 옵션이면 요청 자체를 만들지 않는다
    if (newPP.id === currentPP.id || newPP.lemon_squeezy_variant_id === currentPP.lemon_squeezy_variant_id) {
      return NextResponse.json({ error: 'Already on this plan', code: 'ALREADY_ON_PLAN' }, { status: 400 })
    }
    // ★ tier를 모르는 옵션은 후보가 될 수 없다 — 빈 값이 한도 1로 폴백되면 내림이
    //   '올리기'로 통과하고, 웹훅·전용 DB CHECK가 거부하는 값이면 반영이 영구
    //   실패한다(검증 지적). 발급·저장 가능한 tier(단일 출처 KNOWN_TIERS)만 허용.
    if (!isKnownTier(currentPP.license_tier) || !isKnownTier(newPP.license_tier)) {
      return NextResponse.json({ error: 'Tier unknown', code: 'TIER_UNKNOWN' }, { status: 400 })
    }
    // ★ 올리기만 — PC 한도 비교(기존 판정 함수 재사용, 금액 아님)
    const curLimit = hwidLimitForTier(String(currentPP.license_tier))
    const newLimit = hwidLimitForTier(String(newPP.license_tier))
    if (!(newLimit > curLimit)) {
      return NextResponse.json({ error: 'Not an upgrade', code: 'NOT_UPGRADE' }, { status: 400 })
    }

    const newVariantId = Number(newPP.lemon_squeezy_variant_id)
    if (!Number.isFinite(newVariantId) || newVariantId <= 0) {
      return NextResponse.json({ error: 'Plan has no variant', code: 'PLAN_NOT_FOUND' }, { status: 404 })
    }

    // 4. 결제사에 변경 요청 — 청구 옵션은 지정하지 않는다(결제사 기본 정산에 맡김)
    const apiKey = process.env.LEMONSQUEEZY_API_KEY
    if (!apiKey) {
      throw new Error('LEMONSQUEEZY_API_KEY is not configured')
    }
    const lsRes = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${lsSubId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'subscriptions',
          id: String(lsSubId),
          attributes: { variant_id: newVariantId },
        },
      }),
      cache: 'no-store',
    })

    if (!lsRes.ok) {
      const body = await lsRes.text()
      console.error('[subscriptions/change-plan] Lemon Squeezy API error:', lsRes.status, maskSecretsInText(body))
      if (lsRes.status === 404) {
        return NextResponse.json({ error: 'Subscription not found on Lemon Squeezy', code: 'LS_NOT_FOUND' }, { status: 404 })
      }
      return NextResponse.json({ error: `Lemon Squeezy API error: ${lsRes.status}`, code: 'LS_API_ERROR' }, { status: 502 })
    }

    // 성공 — 우리 DB의 구독·라이선스는 건드리지 않는다. 반영은 결제사 통지(웹훅)가 한다.
    // 돈이 바뀌는 요청이므로 누가 언제 무엇으로 요청했는지 흔적을 남긴다(관리자 로그 조회용).
    await logNotification({
      kind: 'webhook', status: 'success',
      event: '플랜 변경 요청(고객)',
      target: `sub:${subscriptionId} → variant:${newVariantId} (user:${user.id})`,
    })
    console.log(`[subscriptions/change-plan] 플랜 변경 요청 완료: ${subscriptionId} → price ${newPriceId} (variant ${newVariantId})`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[subscriptions/change-plan]', maskSecretsInText(String(err)))
    return NextResponse.json({ error: 'Failed to change plan', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
