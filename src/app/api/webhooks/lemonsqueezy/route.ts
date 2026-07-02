/**
 * @파일: app/api/webhooks/lemonsqueezy/route.ts
 * @설명: Lemon Squeezy 웹훅 핸들러
 *        주문/구독 이벤트를 수신하여 DB(orders, licenses, subscriptions)에 동기화합니다.
 *
 * 처리하는 이벤트:
 *   - order_created              → orders + licenses 생성 (수량 N 주문 → 라이선스 N개)
 *   - subscription_created       → subscriptions 생성
 *   - subscription_updated       → 구독 상태/만료일 업데이트 + license.expires_at 동기화
 *   - subscription_cancelled     → 취소 처리 + license expired
 *   - subscription_expired       → 만료 처리 + license expired
 *   - subscription_payment_success → 갱신(renewal) 결제 성공 → 추천 커미션 반복 적립
 *   - subscription_payment_failed → 결제 실패 → license expired + Sheets 중지
 *   - subscription_payment_refunded → 갱신 결제 환불 → 추천 커미션 반전
 *   - subscription_paused/unpaused → 일시정지/해제
 *   - order_refunded             → 환불 처리 + 주문 커미션 반전
 *
 * 추천 커미션(Wave 4): order_created=첫 결제 적립, subscription_payment_success(renewal)=반복 적립,
 *   order_refunded/subscription_payment_refunded=반전. 적립/반전은 스키마-누락 관용 없음(affiliate-commission.ts).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyLSWebhook,
  generateSerialKey,
  fetchLsLicenseKeys,
  type LSWebhookPayload,
  type LSOrderAttributes,
  type LSSubscriptionAttributes,
  type LSLicenseKeyAttributes,
  type LSSubscriptionInvoiceAttributes,
} from '@/lib/lemonsqueezy'
import { accrueCommission, reverseCommissionsBySource } from '@/lib/affiliate-commission'
import { logNotification } from '@/lib/notification-log'
import { sendEmail, orderConfirmationEmailHtml } from '@/lib/email'
import { appendLicenseRow, updateLicenseExpiry, updateLicenseStatus } from '@/lib/sheets'
import {
  findLicenseInAnyDb as supaFindLicenseInAnyDb,
  insertLicense as supaInsertLicense,
  upsertLicenseForOrder as supaUpsertLicenseForOrder,
  applyLsKeyForOrder as supaApplyLsKeyForOrder,
  updateLicenseExpiry as supaUpdateLicenseExpiry,
  setLicenseActive as supaSetLicenseActive,
  type Tier as SupaTier,
} from '../../license/_lib_supabase'

export const runtime = 'nodejs'

// ─── Supabase 라이선스 제품 식별 헬퍼 (slug 기반 — 표시명과 무관) ─────────────
// 분기 출처 = product.slug = {family}_{tier}_{interval} (예: geniework_1pc_monthly).
// slug는 NOT NULL UNIQUE 안정 식별자(002:9)라 상품명을 한국어로 바꿔도 불변.
// (로직은 기존 name 파싱과 동일 — 토큰 포함 검사. 출처만 name→slug.)
//   - slug에 "geniestock" 포함 → 'geniestock' (tier: lite/pro/max)
//   - slug에 "geniework"  포함 → 'geniework'  (tier: 1pc/3pc/5pc/10pc)
//   - 그 외(geniepost 등) → null → Google Sheets 경로 (절대 수정 금지)
//   - slug에 토큰이 없는 비표준 값이면 기존과 동일하게 null로 폴백.

function isSupabaseProduct(slug: string | null | undefined): 'geniestock' | 'geniework' | null {
  const s = (slug ?? '').toLowerCase()
  if (s.includes('geniestock')) return 'geniestock'
  if (s.includes('geniework'))  return 'geniework'
  return null
}

function tierFromProductName(slug: string | null | undefined): SupaTier | null {
  const s = (slug ?? '').toLowerCase()
  if (s.includes('max'))  return 'max'
  if (s.includes('pro'))  return 'pro'
  if (s.includes('lite')) return 'lite'
  return null
}

function tierFromGenieWork(slug: string | null | undefined): SupaTier | null {
  const s = (slug ?? '').toLowerCase()
  // 10pc 먼저 검사 (1pc 부분 일치 회피)
  if (s.includes('10pc')) return '10pc'
  if (s.includes('5pc'))  return '5pc'
  if (s.includes('3pc'))  return '3pc'
  if (s.includes('1pc'))  return '1pc'
  return null
}

/**
 * @함수명: normalizeTier
 * @설명: product_prices.license_tier(옵션 행 tier) 값을 유효한 SupaTier로 정규화한다.
 *        v2 표준 옵션 구조에서 tier의 1순위 출처. 유효하지 않으면 null을 반환해
 *        호출측이 기존 slug 파싱으로 fallback하게 한다(기존 상품 회귀 방지).
 * @매개변수: value - product_prices.license_tier 값(임의 입력)
 * @반환값: 유효 tier('1pc'|'3pc'|'5pc'|'10pc'|'lite'|'pro'|'max') 또는 null
 */
function normalizeTier(value: unknown): SupaTier | null {
  const s = String(value ?? '').toLowerCase().trim()
  const valid: readonly string[] = ['lite', 'pro', 'max', '1pc', '3pc', '5pc', '10pc']
  return valid.includes(s) ? (s as SupaTier) : null
}

/**
 * @함수명: fetchLicenseTier
 * @설명: 옵션 행(product_prices)의 license_tier를 best-effort로 읽는다.
 *        040 마이그레이션 미적용(컬럼 부재) 시 조회가 에러나면 null을 반환해
 *        웹훅이 기존 slug 파싱 tier로 안전하게 fallback하도록 한다(결제 흐름 불변).
 * @매개변수: productPriceId - 옵션 가격 행 id (없으면 null)
 * @반환값: license_tier 문자열 또는 null
 */
async function fetchLicenseTier(productPriceId: string | null | undefined): Promise<string | null> {
  if (!productPriceId) return null
  const admin = createAdminClient()
  const res = await admin
    .from('product_prices')
    .select('license_tier')
    .eq('id', productPriceId)
    .maybeSingle()
  if (res.error) return null   // 컬럼 미존재(040 미적용) 등 → slug fallback
  return (res.data?.license_tier as string) ?? null
}

/**
 * @함수명: normalizeQuantity
 * @설명: LS 웹훅의 수량 필드를 정규화합니다 — 누락·비수치·1 미만은 1로,
 *        외부 입력이므로 상한(100)으로 방어합니다. (UI는 10까지만 허용)
 * @매개변수: raw - first_order_item.quantity / first_subscription_item.quantity
 * @반환값: 1~100 정수
 */
function normalizeQuantity(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(100, Math.floor(n)))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature') ?? ''

  if (!verifyLSWebhook(rawBody, signature)) {
    console.error('[LS Webhook] 서명 검증 실패')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: LSWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName = payload.meta?.event_name
  console.log(`[LS Webhook] 이벤트 수신: ${eventName}`)

  try {
    switch (eventName) {
      case 'order_created':
        await handleOrderCreated(payload)
        break
      case 'subscription_created':
        await handleSubscriptionCreated(payload)
        break
      case 'subscription_updated':
        await handleSubscriptionUpdated(payload)
        break
      case 'subscription_cancelled':
      case 'subscription_expired':
        await handleSubscriptionCancelled(payload)
        break
      case 'subscription_payment_success':
        await handleSubscriptionPaymentSuccess(payload)
        break
      case 'subscription_payment_failed':
        await handlePaymentFailed(payload)
        break
      case 'subscription_payment_refunded':
        await handleSubscriptionPaymentRefunded(payload)
        break
      case 'subscription_paused':
        await handleSubscriptionStatusChange(payload, 'paused')
        break
      case 'subscription_unpaused':
        await handleSubscriptionStatusChange(payload, 'active')
        break
      case 'order_refunded':
        await handleOrderRefunded(payload)
        break
      case 'license_key_created':
        await handleLicenseKeyCreated(payload)
        break
      default:
        console.log(`[LS Webhook] 처리하지 않는 이벤트: ${eventName}`)
    }
  } catch (err) {
    console.error(`[LS Webhook] 이벤트 처리 중 오류 (event=${eventName}, data_id=${payload.data?.id ?? 'N/A'}):`, err)
    // 실패 기록(best-effort — 기록 실패해도 웹훅 응답/흐름 불변)
    await logNotification({
      kind:   'webhook',
      status: 'failure',
      event:  eventName ?? null,
      target: payload.data?.id ? String(payload.data.id) : null,
      error:  String(err),
    })
    return NextResponse.json({ received: true, error: String(err) }, { status: 200 })
  }

  return NextResponse.json({ received: true })
}

// ─── 사용자 조회 ────────────────────────────────────────────────────────────

async function findUserId(
  customUserId: string | undefined,
  email: string,
): Promise<string | null> {
  const admin = createAdminClient()

  if (customUserId) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('id', customUserId)
      .single()
    if (data) return data.id
  }

  const { data } = await admin.rpc('get_user_id_by_email', { p_email: email })
  return data ?? null
}

// ─── 구독 ID로 연결된 라이선스 목록 조회 (Sheets/라이선스 DB 동기화용) ─────────
// 수량 N 주문은 한 주문에 라이선스가 N개 — 전부 반환한다 (created_at 순).

async function findLicensesByLsSubId(
  lsSubId: string,
): Promise<{ orderId: string; licenses: { licenseId: string; serialKey: string }[] } | null> {
  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('order_id')
    .eq('lemon_squeezy_subscription_id', lsSubId)
    .single()
  if (!sub?.order_id) return null

  const { data: lics } = await admin
    .from('licenses')
    .select('id, serial_key')
    .eq('order_id', sub.order_id)
    .order('created_at', { ascending: true })
  if (!lics || lics.length === 0) return null

  return {
    orderId: sub.order_id,
    licenses: lics.map((l) => ({ licenseId: l.id as string, serialKey: l.serial_key as string })),
  }
}

// ─── order_created 핸들러 ──────────────────────────────────────────────────

async function handleOrderCreated(payload: LSWebhookPayload) {
  const attrs = payload.data.attributes as LSOrderAttributes
  const lsOrderId = String(payload.data.id)

  if (attrs.status !== 'paid') {
    console.log(`[LS Webhook] 주문 ${lsOrderId} 상태가 paid가 아님: ${attrs.status}`)
    return
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('orders')
    .select('id')
    .eq('lemon_squeezy_order_id', lsOrderId)
    .single()
  if (existing) {
    console.log(`[LS Webhook] 이미 처리된 주문: ${lsOrderId}`)
    return
  }

  const userId = await findUserId(payload.meta.custom_data?.user_id, attrs.user_email)
  if (!userId) {
    console.error(`[LS Webhook] 사용자 없음 — 주문 미생성 (order_id=${lsOrderId}, email=${attrs.user_email})`)
    return
  }

  const variantId = String(attrs.first_order_item?.variant_id)
  const { data: productPrice } = await admin
    .from('product_prices')
    .select('id, product_id, type, interval')
    .eq('lemon_squeezy_variant_id', variantId)
    .single()

  let bundleId: string | null = null
  let productPriceId: string | null = productPrice?.id ?? null
  let productId: string | null = productPrice?.product_id ?? null

  if (!productPriceId) {
    const { data: bundleData } = await admin
      .from('bundles')
      .select('id')
      .or(`lemon_squeezy_monthly_variant_id.eq.${variantId},lemon_squeezy_annual_variant_id.eq.${variantId}`)
      .single()
    if (bundleData) bundleId = bundleData.id
  }

  if (!productPriceId && !bundleId) {
    console.error(`[LS Webhook] variant_id ${variantId}에 매칭되는 상품 없음 — 주문만 기록·라이선스 미생성 (order_id=${lsOrderId})`)
  }

  const quantity = normalizeQuantity(attrs.first_order_item?.quantity)
  const discountCents = Number(attrs.discount_total ?? 0)

  const orderInsert: Record<string, unknown> = {
    user_id: userId,
    lemon_squeezy_order_id: lsOrderId,
    status: 'paid',
    amount: attrs.total,
    currency: attrs.currency,
  }
  if (productPriceId) orderInsert.product_price_id = productPriceId
  if (bundleId) orderInsert.bundle_id = bundleId
  // 수량·할인(cents) 기록 — 038 마이그레이션 컬럼. 기본값(1·0)이면 생략해
  // 마이그레이션 미적용 상태에서도 일반 주문 INSERT는 깨지지 않게 한다.
  if (quantity > 1) orderInsert.quantity = quantity
  if (Number.isFinite(discountCents) && discountCents > 0) orderInsert.discount_amount = discountCents

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert(orderInsert)
    .select('id')
    .single()

  if (orderErr || !order) {
    throw new Error(`주문 생성 실패: ${orderErr?.message}`)
  }

  console.log(`[LS Webhook] 주문 생성 완료: ${order.id}`)

  if (productPriceId && productId && productPrice?.type === 'one_time') {
    // 수량 N 주문 → 라이선스 N개 발급. tier는 옵션 행 license_tier 우선(best-effort)
    const licenseTier = await fetchLicenseTier(productPriceId)
    await createLicense(userId, order.id, productId, attrs.user_email, attrs.user_name, lsOrderId, quantity, licenseTier)
  }

  // 추천 커미션 적립 (일회성·구독 초기 공통의 "첫 결제"). 갱신은 subscription_payment_success.
  // 스키마-누락 관용 없음 — 실패 시 throw로 전파(웹훅 메인 catch가 로깅).
  await accrueCommission({
    sourceType: 'order',
    sourceId: lsOrderId,
    buyerUserId: userId,
    affiliateRefRaw: payload.meta.custom_data?.affiliate_ref ?? payload.meta.custom_data?.ref,
    grossCents: attrs.total,
    currency: attrs.currency,
    orderId: order.id, // 첫 order 적립 시 attribution.converted_at·order_id 기록용(내부 uuid)
  })
}

// ─── subscription_payment_success 핸들러 (갱신 반복 적립) ────────────────────
// 초기 결제는 order_created가 이미 적립하므로 billing_reason='renewal'만 처리.
// data = subscription-invoice (data.id = 인보이스 단위 멱등 키). 금액은 정수 cents.

async function handleSubscriptionPaymentSuccess(payload: LSWebhookPayload) {
  const attrs = payload.data.attributes as LSSubscriptionInvoiceAttributes

  if (attrs.billing_reason !== 'renewal') {
    console.log(`[LS Webhook] subscription_payment_success(${attrs.billing_reason}) — 갱신 아님, 적립 skip`)
    return
  }

  const invoiceId = String(payload.data.id)
  const lsSubId = String(attrs.subscription_id)
  const admin = createAdminClient()

  // 구매자: 구독 행의 user_id 우선(신뢰), 폴백 custom_data.user_id
  const { data: sub } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('lemon_squeezy_subscription_id', lsSubId)
    .maybeSingle()

  let buyerUserId: string | null = (sub?.user_id as string) ?? null
  if (!buyerUserId && payload.meta.custom_data?.user_id) {
    buyerUserId = await findUserId(payload.meta.custom_data.user_id, attrs.user_email ?? '')
  }
  if (!buyerUserId) {
    console.error(`[LS Webhook] 갱신 적립: 구매자 미상 (sub=${lsSubId}, invoice=${invoiceId})`)
    return
  }

  await accrueCommission({
    sourceType: 'subscription_renewal',
    sourceId: invoiceId,
    buyerUserId,
    affiliateRefRaw: payload.meta.custom_data?.affiliate_ref ?? payload.meta.custom_data?.ref,
    grossCents: attrs.total,
    currency: attrs.currency ?? '',
    subscriptionId: lsSubId,
  })
}

// ─── subscription_payment_refunded 핸들러 (갱신 결제 환불 → 커미션 반전) ──────
// 갱신 환불은 order_refunded가 아니라 이 이벤트로 도착(data = subscription-invoice).
// data.id = 갱신 인보이스 id = 갱신 커미션의 source_id 와 일치하므로 그대로 반전한다.
// (구독/라이선스 상태는 cancelled/expired 이벤트가 담당 — 여기선 커미션만)

async function handleSubscriptionPaymentRefunded(payload: LSWebhookPayload) {
  const invoiceId = String(payload.data.id)
  console.log(`[LS Webhook] 구독 갱신 환불 수신: invoice ${invoiceId}`)
  await reverseCommissionsBySource('subscription_renewal', invoiceId)
}

// ─── subscription_created 핸들러 ─────────────────────────────────────────────

async function handleSubscriptionCreated(payload: LSWebhookPayload) {
  const attrs = payload.data.attributes as LSSubscriptionAttributes
  const lsSubId = String(payload.data.id)

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('lemon_squeezy_subscription_id', lsSubId)
    .single()
  if (existing) {
    console.log(`[LS Webhook] 이미 처리된 구독: ${lsSubId}`)
    return
  }

  const userId = await findUserId(payload.meta.custom_data?.user_id, attrs.user_email)
  if (!userId) {
    console.error(`[LS Webhook] 구독 사용자 없음 — 구독/라이선스 미생성 (order_id=${attrs.order_id}, sub=${lsSubId}, email=${attrs.user_email})`)
    return
  }

  const variantId = String(attrs.variant_id)
  const { data: productPrice } = await admin
    .from('product_prices')
    .select('id, product_id, interval')
    .eq('lemon_squeezy_variant_id', variantId)
    .single()

  let bundleId: string | null = null
  if (!productPrice) {
    const { data: bundleData } = await admin
      .from('bundles')
      .select('id')
      .or(`lemon_squeezy_monthly_variant_id.eq.${variantId},lemon_squeezy_annual_variant_id.eq.${variantId}`)
      .single()
    if (bundleData) bundleId = bundleData.id
  }

  // 구독 수량(좌석) — 스텁 주문 기록·라이선스 N개 발급에 공용
  const quantity = normalizeQuantity(attrs.first_subscription_item?.quantity)

  const lsOrderId = String(attrs.order_id)
  let orderId: string | null = null
  const { data: existingOrder } = await admin
    .from('orders')
    .select('id')
    .eq('lemon_squeezy_order_id', lsOrderId)
    .single()

  if (existingOrder) {
    orderId = existingOrder.id
  } else {
    console.log(`[LS Webhook] 주문 미존재, subscription_created에서 생성: ${lsOrderId}`)
    const orderInsert: Record<string, unknown> = {
      user_id: userId,
      lemon_squeezy_order_id: lsOrderId,
      status: 'paid',
      amount: 0,
      currency: 'KRW', // 스토어 통화(KRW)로 통일 — 실제 금액·통화는 order_created가 채움(여기선 스텁)
    }
    if (productPrice) orderInsert.product_price_id = productPrice.id
    if (bundleId) orderInsert.bundle_id = bundleId
    if (quantity > 1) orderInsert.quantity = quantity  // 038 마이그레이션 컬럼 — 기본값(1)이면 생략
    const { data: newOrder } = await admin
      .from('orders')
      .insert(orderInsert)
      .select('id')
      .single()
    orderId = newOrder?.id ?? null
  }

  const billingInterval = productPrice?.interval === 'annual' ? 'annual' : 'monthly'

  const subInsert: Record<string, unknown> = {
    user_id: userId,
    order_id: orderId,
    lemon_squeezy_subscription_id: lsSubId,
    status: mapLSSubStatus(attrs.status),
    current_period_start: new Date().toISOString(),
    current_period_end: attrs.renews_at ?? null,
    cancel_at_period_end: attrs.cancelled,
    billing_interval: billingInterval,
    customer_portal_url: attrs.urls?.customer_portal ?? null,
  }
  if (productPrice) subInsert.product_price_id = productPrice.id
  if (bundleId) subInsert.bundle_id = bundleId

  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .insert(subInsert)
    .select('id')
    .single()

  if (subErr || !sub) {
    throw new Error(`구독 생성 실패: ${subErr?.message}`)
  }

  console.log(`[LS Webhook] 구독 생성 완료: ${sub.id}`)

  if (productPrice?.product_id && orderId) {
    // 구독 수량(좌석) N → 라이선스 N개 발급. tier는 옵션 행 license_tier 우선(best-effort)
    const licenseTier = await fetchLicenseTier(productPrice.id)
    await createLicense(userId, orderId, productPrice.product_id, attrs.user_email, attrs.user_name, lsOrderId, quantity, licenseTier)
  }
}

// ─── license_key_created 핸들러 (LS 자동 발급 키를 정식 키로 반영) ───────────────
// LS "License keys" ON 제품은 구매 시 license_key_created가 별도로 도착한다(타이밍상
// subscription_created보다 먼저 올 수 있음). 이 키를 order_id로 license_keys에 반영해
// DB 키 = 이메일 키가 되게 한다. ★GenieWork 전용 — geniestock 오라우팅 금지.

async function handleLicenseKeyCreated(payload: LSWebhookPayload) {
  const attrs = payload.data.attributes as LSLicenseKeyAttributes
  const lsKey       = attrs.key
  const lsOrderId   = attrs.order_id != null ? String(attrs.order_id) : ''
  const lsProductId = attrs.product_id != null ? String(attrs.product_id) : ''
  const userEmail   = attrs.user_email ?? null

  if (!lsKey || !lsOrderId) {
    console.warn('[LS Webhook] license_key_created: key/order_id 누락 — skip')
    return
  }

  // product 판별: LS product_id → product_prices.lemon_squeezy_product_id → products.slug → isSupabaseProduct
  const supaSlug = await resolveSupabaseProductByLsProductId(lsProductId)
  if (supaSlug !== 'geniework') {
    // geniework가 아니면 아무것도 안 함 (geniestock 오라우팅 절대 금지 · geniepost 무관)
    console.log(`[LS Webhook] license_key_created: geniework 아님(${supaSlug ?? 'unknown'}) — skip (order_id=${lsOrderId})`)
    return
  }

  // GW DB에 LS 키 반영 (행 있으면 UPDATE, 없으면 stub INSERT)
  const { action, replacedKey } = await supaApplyLsKeyForOrder({
    lsOrderId,
    lsKey,
    product: 'geniework',
    buyerEmail: userEmail,
  })
  console.log(`[LS Webhook] license_key_created: geniework GW DB ${action} (order_id=${lsOrderId})`)

  // 본체 licenses 행이 이미 있으면 serial_key·LS키 컬럼 동기화 (없으면 subscription_created가 finalKey로 생성)
  // replacedKey가 있으면 GW DB에서 교체된 "그 행"과 같은 키의 본체 행만 동기화 (수량 N 정합)
  await syncCoreLicenseKey(lsOrderId, lsKey, replacedKey ?? null)
}

// LS product_id(숫자 문자열)로 CoreZent 본체에서 제품 판별.
// product_prices.lemon_squeezy_product_id 시드 기준 → products.slug → isSupabaseProduct.
// (license_key_created 선도착 시 orders가 아직 없을 수 있어 product_id→slug 경로 사용 — orders 비의존.)
async function resolveSupabaseProductByLsProductId(
  lsProductId: string,
): Promise<'geniestock' | 'geniework' | null> {
  if (!lsProductId) return null
  const admin = createAdminClient()
  const { data: ppRows } = await admin
    .from('product_prices')
    .select('product_id')
    .eq('lemon_squeezy_product_id', lsProductId)
    .limit(1)
  const corePid = ppRows?.[0]?.product_id as string | undefined
  if (!corePid) return null
  const { data: product } = await admin
    .from('products')
    .select('slug')
    .eq('id', corePid)
    .single()
  return isSupabaseProduct(product?.slug)
}

// 본체 licenses 행이 있으면 serial_key·lemon_squeezy_license_key를 LS 키로 동기화(대시보드 일관).
// 수량 N 주문은 행이 N개일 수 있음 — LS 키(주문당 1개)는 "GW DB에서 교체된 옛 키(replacedKey)와
// 같은 키의 행"에 반영해 두 DB의 키 집합을 일치시킨다. replacedKey가 없으면 첫 행에 반영.
// 어느 행이든 이미 LS 키를 가지고 있으면 noop (멱등).
async function syncCoreLicenseKey(lsOrderId: string, lsKey: string, replacedKey?: string | null) {
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id')
    .eq('lemon_squeezy_order_id', lsOrderId)
    .maybeSingle()
  if (!order?.id) return
  const { data: lics } = await admin
    .from('licenses')
    .select('id, serial_key')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  if (!lics || lics.length === 0) return
  if (lics.some((l) => l.serial_key === lsKey)) return
  const target = (replacedKey ? lics.find((l) => l.serial_key === replacedKey) : null) ?? lics[0]
  const { error } = await admin
    .from('licenses')
    .update({ serial_key: lsKey, lemon_squeezy_license_key: lsKey })
    .eq('id', target.id)
  if (error) console.error('[LS Webhook] 본체 licenses 키 동기화 실패:', error.message)
}

// ─── subscription_updated 핸들러 ─────────────────────────────────────────────

async function handleSubscriptionUpdated(payload: LSWebhookPayload) {
  const attrs = payload.data.attributes as LSSubscriptionAttributes
  const lsSubId = String(payload.data.id)
  const newStatus = mapLSSubStatus(attrs.status)

  const admin = createAdminClient()
  const { error } = await admin
    .from('subscriptions')
    .update({
      status: newStatus,
      current_period_end: attrs.renews_at ?? null,
      cancel_at_period_end: attrs.cancelled,
      customer_portal_url: attrs.urls?.customer_portal ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('lemon_squeezy_subscription_id', lsSubId)

  if (error) throw new Error(`구독 업데이트 실패: ${error.message}`)
  console.log(`[LS Webhook] 구독 업데이트 완료: ${lsSubId} → ${newStatus}`)

  // 라이선스 조회 (Sheets 업데이트 + DB 동기화) — 수량 N 주문이면 N개 전부
  const licInfo = await findLicensesByLsSubId(lsSubId)

  // 구독 갱신 시 → license.expires_at 동기화 + (GenieStock: Supabase / GeniePost: Sheets) 갱신
  if (attrs.renews_at && licInfo) {
    try {
      // DB license.expires_at를 구독 갱신일과 동기화 (주문의 모든 라이선스 공통)
      await admin
        .from('licenses')
        .update({ expires_at: attrs.renews_at, status: 'active' })
        .eq('order_id', licInfo.orderId)

      // 키별 라우팅: 어느 라이선스 DB(공유+GW)에 있는지 찾아 그 DB로 동기화, 없으면 GeniePost(Sheets)
      for (const lic of licInfo.licenses) {
        const found = await supaFindLicenseInAnyDb(lic.serialKey)
        if (found) {
          // GenieStock/GenieWork 경로 — 찾은 DB(found.db)에 만료일/활성 동기화
          const p = found.db === 'geniework' ? 'geniework' : 'geniestock'
          await supaUpdateLicenseExpiry(lic.serialKey, attrs.renews_at, p)
          if (newStatus === 'active') {
            await supaSetLicenseActive(lic.serialKey, true, p)
          }
          console.log(`[LS Webhook] Supabase(${found.db}) 만료일 동기화 완료: ${lic.serialKey.slice(0, 8)}...`)
        } else {
          // GeniePost 경로 — Sheets 동기화 (기존 로직 그대로)
          await updateLicenseExpiry({ serialKey: lic.serialKey, expiresAt: attrs.renews_at })
          if (newStatus === 'active') {
            await updateLicenseStatus({ serialKey: lic.serialKey, status: '활성' })
          }
          console.log(`[LS Webhook] 라이선스 만료일 동기화 완료: ${lic.serialKey.slice(0, 8)}...`)
        }
      }
    } catch (syncErr) {
      console.error('[LS Webhook] Sheets/DB 동기화 실패:', syncErr)
    }
  }
}

// ─── subscription_cancelled / expired 핸들러 ─────────────────────────────────

async function handleSubscriptionCancelled(payload: LSWebhookPayload) {
  const attrs = payload.data.attributes as LSSubscriptionAttributes
  const lsSubId = String(payload.data.id)
  const isCancelled = payload.meta.event_name === 'subscription_cancelled'

  const admin = createAdminClient()

  const { error } = await admin
    .from('subscriptions')
    .update({
      status: isCancelled ? 'cancelled' : 'expired',
      cancel_at_period_end: isCancelled ? true : false,
      current_period_end: attrs.ends_at ?? attrs.renews_at ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('lemon_squeezy_subscription_id', lsSubId)

  if (error) throw new Error(`구독 취소 처리 실패: ${error.message}`)
  console.log(`[LS Webhook] 구독 취소/만료 처리 완료: ${lsSubId}`)

  // 연결된 라이선스 상태도 expired로 변경 (수량 N 주문이면 N개 전부)
  const licInfo = await findLicensesByLsSubId(lsSubId)
  if (licInfo) {
    await admin
      .from('licenses')
      .update({ status: 'expired' })
      .eq('order_id', licInfo.orderId)

    try {
      // 키별 라우팅: 양쪽 DB(공유+GW)에서 키를 찾아 그 DB로 비활성화, 없으면 GeniePost(Sheets)
      for (const lic of licInfo.licenses) {
        const found = await supaFindLicenseInAnyDb(lic.serialKey)
        if (found) {
          const p = found.db === 'geniework' ? 'geniework' : 'geniestock'
          await supaSetLicenseActive(lic.serialKey, false, p)
          console.log(`[LS Webhook] Supabase(${found.db}) 비활성화 완료: ${lic.serialKey.slice(0, 8)}...`)
        } else {
          await updateLicenseStatus({ serialKey: lic.serialKey, status: '중지' })
          console.log(`[LS Webhook] Sheets 상태 중지 처리 완료: ${lic.serialKey.slice(0, 8)}...`)
        }
      }
    } catch (syncErr) {
      console.error('[LS Webhook] 비활성화 동기화 실패:', syncErr)
    }
  }
}

// ─── subscription_payment_failed 핸들러 ──────────────────────────────────────

async function handlePaymentFailed(payload: LSWebhookPayload) {
  const lsSubId = String(payload.data.id)

  const admin = createAdminClient()

  // 구독 상태를 expired로 업데이트
  const { error } = await admin
    .from('subscriptions')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('lemon_squeezy_subscription_id', lsSubId)

  if (error) throw new Error(`결제 실패 처리 실패: ${error.message}`)
  console.log(`[LS Webhook] 결제 실패 처리 완료: ${lsSubId}`)

  // 연결된 라이선스 상태도 expired로 변경 + (GenieStock: Supabase / GeniePost: Sheets) 중지
  // (수량 N 주문이면 N개 전부)
  const licInfo = await findLicensesByLsSubId(lsSubId)
  if (licInfo) {
    await admin
      .from('licenses')
      .update({ status: 'expired' })
      .eq('order_id', licInfo.orderId)

    try {
      for (const lic of licInfo.licenses) {
        const found = await supaFindLicenseInAnyDb(lic.serialKey)
        if (found) {
          const p = found.db === 'geniework' ? 'geniework' : 'geniestock'
          await supaSetLicenseActive(lic.serialKey, false, p)
          console.log(`[LS Webhook] 결제 실패 → Supabase(${found.db}) 비활성화: ${lic.serialKey.slice(0, 8)}...`)
        } else {
          await updateLicenseStatus({ serialKey: lic.serialKey, status: '중지' })
          console.log(`[LS Webhook] 결제 실패 → Sheets 중지: ${lic.serialKey.slice(0, 8)}...`)
        }
      }
    } catch (syncErr) {
      console.error('[LS Webhook] 결제 실패 동기화 실패:', syncErr)
    }
  }

  // 추천 커미션 반전(갱신 인보이스 대상). 실패한 갱신은 보통 적립 전이라 no-op이나, 매칭 시 reversed.
  await reverseCommissionsBySource('subscription_renewal', String(payload.data.id))
}

// ─── subscription_paused / unpaused 핸들러 ───────────────────────────────────

async function handleSubscriptionStatusChange(payload: LSWebhookPayload, status: 'paused' | 'active') {
  const lsSubId = String(payload.data.id)
  const admin = createAdminClient()
  const { error } = await admin
    .from('subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('lemon_squeezy_subscription_id', lsSubId)
  if (error) throw new Error(`구독 상태 변경 실패: ${error.message}`)
  console.log(`[LS Webhook] 구독 상태 변경 완료: ${lsSubId} → ${status}`)
}

// ─── order_refunded 핸들러 ────────────────────────────────────────────────────

async function handleOrderRefunded(payload: LSWebhookPayload) {
  const lsOrderId = String(payload.data.id)
  const admin = createAdminClient()

  const { data: order, error } = await admin
    .from('orders')
    .update({ status: 'refunded' })
    .eq('lemon_squeezy_order_id', lsOrderId)
    .select('id')
    .single()

  if (error) throw new Error(`환불 처리 실패: ${error.message}`)
  if (!order) return

  // 수량 N 주문이면 라이선스 N개 전부 revoke
  const { data: lics } = await admin
    .from('licenses')
    .update({ status: 'revoked' })
    .eq('order_id', order.id)
    .select('serial_key')

  await admin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('order_id', order.id)

  console.log(`[LS Webhook] 환불 처리 완료: ${lsOrderId}`)

  for (const lic of lics ?? []) {
    if (!lic?.serial_key) continue
    try {
      const found = await supaFindLicenseInAnyDb(lic.serial_key)
      if (found) {
        const p = found.db === 'geniework' ? 'geniework' : 'geniestock'
        await supaSetLicenseActive(lic.serial_key, false, p)
        console.log(`[LS Webhook] 환불 → Supabase(${found.db}) 비활성화: ${lic.serial_key.slice(0, 8)}...`)
      } else {
        await updateLicenseStatus({ serialKey: lic.serial_key, status: '중지' })
        console.log(`[LS Webhook] Sheets 상태 중지 처리 완료: ${lic.serial_key.slice(0, 8)}...`)
      }
    } catch (syncErr) {
      console.error('[LS Webhook] 환불 동기화 실패:', syncErr)
    }
  }

  // 추천 커미션 반전(이미 paid면 클로백·음수잔액 금지+관리자 플래그). 스키마-누락 관용 없음.
  // order_refunded는 주문(첫 결제) 커미션을 대상으로 함 — source_type='order'로 좁힘.
  await reverseCommissionsBySource('order', lsOrderId)
}

// ─── 라이선스 생성 ────────────────────────────────────────────────────────────

/**
 * @함수명: createLicense
 * @설명: 주문/구독 완료 후 라이선스를 생성하고 이메일로 발송합니다.
 *        수량 N 주문이면 라이선스를 N개 발급합니다 (키 #1 = LS 발급 키 우선, 나머지 = 자체 생성).
 *        일반 제품: CoreZent에서 시리얼 키 자체 생성
 *        Pro 제품: LS에서 자동 발급한 라이선스 키를 API로 조회하여 사용
 *        Sheets G열에 Pro면 TRUE 기록.
 * @매개변수: quantity - 구매 수량 (기본 1, normalizeQuantity로 정규화된 값)
 * @매개변수: licenseTier - v2 옵션 행의 license_tier(우선). 비면 slug 파싱 tier로 fallback.
 */
async function createLicense(
  userId: string,
  orderId: string,
  productId: string,
  userEmail: string,
  userName: string,
  lsOrderId?: string,
  quantity: number = 1,
  licenseTier?: string | null,
) {
  const admin = createAdminClient()

  // 멱등성: 이 주문의 라이선스가 하나라도 있으면 전체 skip (웹훅 재전송 대비).
  // (기존 .single()은 N행에서 에러 → existing=null로 중복 발급 위험이 있어 limit(1)로 교체)
  const { data: existingRows } = await admin
    .from('licenses')
    .select('id')
    .eq('order_id', orderId)
    .limit(1)

  if (existingRows && existingRows.length > 0) {
    console.log(`[LS Webhook] 라이선스 이미 존재: ${existingRows[0].id}`)
    return
  }

  const { data: product } = await admin
    .from('products')
    .select('slug, name, max_devices, license_duration_days')
    .eq('id', productId)
    .single()

  // 분기 출처 = product.slug (표시명과 무관, 안정 식별자). slug={family}_{tier}_{interval}.
  const productSlug = (product?.slug ?? '').toLowerCase()

  // ─── Supabase 라이선스 분기 (GenieStock / GenieWork) ────────────────────
  // slug에 "geniestock"|"geniework" 포함 시 Supabase license_keys 에 등록.
  // Sheets append 는 스킵 (시트는 GeniePost 전용 — 절대 수정 금지).
  // CoreZent 내부 licenses 테이블에는 동일하게 INSERT (대시보드용).
  const supaSlug = isSupabaseProduct(productSlug)
  if (supaSlug) {
    // tier 결정: v2 옵션 행 license_tier 우선, 없으면 기존 slug 파싱 fallback(회귀 방지)
    const tier = normalizeTier(licenseTier)
      ?? (supaSlug === 'geniework'
        ? tierFromGenieWork(productSlug)
        : tierFromProductName(productSlug))
    if (!tier) {
      console.error(`[LS Webhook] ${supaSlug} tier 추출 실패 — 라이선스 미생성 (order_id=${lsOrderId ?? 'N/A'}, slug="${productSlug}", license_tier="${licenseTier ?? ''}")`)
      return
    }

    // 키 목록 구성: LS 자동 발급 키 우선(LS는 수량 무관 주문당 1개가 기본), 부족분은 자체 생성
    let lsKeys: string[] = []
    if (lsOrderId) {
      lsKeys = await fetchLsLicenseKeys(lsOrderId)
      if (lsKeys.length === 0) {
        console.warn(`[LS Webhook] ${supaSlug} LS 키 조회 실패 — 자체키 폴백(대시보드 자체키 표시 위험) (order_id=${lsOrderId})`)
      }
    }
    const keys: { key: string; fromLs: boolean }[] = []
    for (let i = 0; i < quantity; i++) {
      const lsKey = lsKeys[i]
      keys.push(lsKey ? { key: lsKey, fromLs: true } : { key: generateSerialKey(), fromLs: false })
    }

    // 만료일: 구독 갱신일 우선, 없으면 license_duration_days
    let gsExpiresAt: string | null = null
    const { data: gsLinkedSub } = await admin
      .from('subscriptions')
      .select('current_period_end')
      .eq('order_id', orderId)
      .single()
    if (gsLinkedSub?.current_period_end) {
      gsExpiresAt = gsLinkedSub.current_period_end
    } else if (product?.license_duration_days) {
      const d = new Date()
      d.setDate(d.getDate() + product.license_duration_days)
      gsExpiresAt = d.toISOString()
    }

    // ─── 라이선스 키 저장 (수량 N이면 키별 반복) ─────────────────────────────
    // geniework: "첫 키만" ls_order_id 기준 upsert (GW DB). license_key_created가 먼저 LS키
    //   stub을 만들었으면 그 LS키가 보존되고(finalKey=LS키) 여기선 tier/expires/buyer만 채운다.
    //   추가 키(#2~N)는 ls_order_id 없는 일반 INSERT — upsert/applyLsKeyForOrder의
    //   "ls_order_id당 1행(maybeSingle)" 가정이 그대로 유지된다.
    // geniestock: 기존 insert (공유 DB엔 ls_order_id 컬럼 없음 — ls_order_id 경로로 절대 안 보냄).
    const coreRows: Record<string, unknown>[] = []
    for (let i = 0; i < keys.length; i++) {
      let finalKey = keys[i].key
      let lemonKeyForCore: string | null = keys[i].fromLs ? keys[i].key : null
      try {
        if (supaSlug === 'geniework' && lsOrderId && i === 0) {
          const r = await supaUpsertLicenseForOrder({
            lsOrderId,
            licenseKey: finalKey,
            tier,
            buyerEmail: userEmail,
            expiresAt:  gsExpiresAt,
            source:     'lemon_squeezy',
            product:    'geniework',
          })
          finalKey = r.finalKey
          if (r.wasExisting) lemonKeyForCore = finalKey  // stub의 LS키 보존됨
          console.log(`[LS Webhook] geniework GW DB ${r.wasExisting ? '메타 갱신(LS키 보존)' : '신규 등록'} (order_id=${lsOrderId}, tier=${tier})`)
        } else {
          await supaInsertLicense({
            licenseKey: finalKey,
            tier,
            buyerEmail: userEmail,
            expiresAt:  gsExpiresAt,
            source:     'lemon_squeezy',
            product:    supaSlug,
          })
          console.log(`[LS Webhook] ${supaSlug} Supabase 등록 완료 (tier=${tier}, ${i + 1}/${keys.length})`)
        }
      } catch (supaErr) {
        console.error(`[LS Webhook] ${supaSlug} Supabase(license_keys) 등록 실패 (order_id=${lsOrderId ?? 'N/A'}, tier=${tier}):`, supaErr)
      }

      const row: Record<string, unknown> = {
        user_id:    userId,
        order_id:   orderId,
        product_id: productId,
        serial_key: finalKey,
        status:     'active',
        max_devices: product?.max_devices ?? null,
        expires_at: gsExpiresAt,
      }
      if (lemonKeyForCore) row.lemon_squeezy_license_key = lemonKeyForCore
      coreRows.push(row)
    }

    // CoreZent 내부 licenses 테이블에도 INSERT (대시보드 표시용) — N행 단일 문장(원자적)
    const { error: gsLicErr } = await admin.from('licenses').insert(coreRows)
    if (gsLicErr) {
      console.error(`[LS Webhook] ${supaSlug} CoreZent licenses INSERT 실패 — 대시보드 미표시 (order_id=${lsOrderId ?? 'N/A'}): ${gsLicErr.message}`)
    }

    // 키 이메일은 서버가 보내지 않는다 — geniestock·geniework는 LemonSqueezy
    // "License keys" 기능 ON이라 LS가 자체 키를 구매자에게 직접 이메일로 발송한다.
    // 서버도 보내면 이메일 2통(중복)이 되므로 서버 발송 제거.
    // (키 생성·supaInsertLicense·CoreZent licenses 기록은 위에서 그대로 수행됨.)

    // Sheets append SKIP (Supabase 경로는 시트 사용 안 함)
    return
  }

  // ─── GeniePost 경로 (Google Sheets) — Sheets 로직 절대 수정 금지 ──────────
  // slug 기반 라이선스 방식 판별 (표시명과 무관 — slug={family}_{tier}_{interval})
  // GeniePost(일반)만 CoreZent 자체 시리얼 키 생성, 나머지(Pro + 모든 신규 상품)는 LS 자동 발급 키 사용
  const isPro = !productSlug.includes('geniepost') || productSlug.includes('pro')
  // isPro === true: LS 라이선스 사용 (Pro 및 모든 신규 상품)
  // isPro === false: GeniePost 일반만 자체 생성

  // 키 목록 구성: Pro/신규 상품은 LS 발급 키 우선(LS는 수량 무관 주문당 1개가 기본),
  // 부족분·GeniePost 일반은 자체 시리얼 키 생성 (기존 행·같은 배치 내 충돌 시 재시도)
  let lsKeys: string[] = []
  if (isPro && lsOrderId) {
    lsKeys = await fetchLsLicenseKeys(lsOrderId)
    if (lsKeys.length > 0) {
      console.log(`[LS Webhook] LS 라이선스 키 조회 완료: ${lsKeys.length}개`)
    } else {
      console.warn(`[LS Webhook] LS 키 조회 실패 — 자체키 폴백(대시보드 자체키 표시 위험) (order_id=${lsOrderId})`)
    }
  }

  const keys: { key: string; fromLs: boolean }[] = []
  for (let i = 0; i < quantity; i++) {
    const lsKey = isPro ? lsKeys[i] : undefined
    if (lsKey) {
      keys.push({ key: lsKey, fromLs: true })
      continue
    }
    let sk = generateSerialKey()
    for (let t = 0; t < 5; t++) {
      const inBatch = keys.some((k) => k.key === sk)
      const { data: dup } = await admin
        .from('licenses')
        .select('id')
        .eq('serial_key', sk)
        .maybeSingle()
      if (!dup && !inBatch) break
      sk = generateSerialKey()
    }
    keys.push({ key: sk, fromLs: false })
  }

  // 만료일: 구독인 경우 subscription.current_period_end 사용, 아니면 license_duration_days
  let expiresAt: string | null = null

  // 먼저 이 주문에 연결된 구독의 갱신일 확인
  const { data: linkedSub } = await admin
    .from('subscriptions')
    .select('current_period_end')
    .eq('order_id', orderId)
    .single()

  if (linkedSub?.current_period_end) {
    expiresAt = linkedSub.current_period_end
  } else if (product?.license_duration_days) {
    const d = new Date()
    d.setDate(d.getDate() + product.license_duration_days)
    expiresAt = d.toISOString()
  }

  // 라이선스 N행 단일 INSERT (원자적 — 부분 생성 상태가 남지 않음)
  const licenseRows = keys.map(({ key, fromLs }) => {
    const row: Record<string, unknown> = {
      user_id: userId,
      order_id: orderId,
      product_id: productId,
      serial_key: key,
      status: 'active',
      max_devices: product?.max_devices ?? null,
      expires_at: expiresAt,
    }
    if (fromLs) row.lemon_squeezy_license_key = key
    return row
  })

  const { data: inserted, error: licErr } = await admin
    .from('licenses')
    .insert(licenseRows)
    .select('id')

  if (licErr || !inserted || inserted.length === 0) {
    throw new Error(`라이선스 생성 실패: ${licErr?.message}`)
  }

  console.log(`[LS Webhook] 라이선스 생성 완료: ${inserted.length}개 (${keys[0].key.slice(0, 8)}...)${isPro ? ' [Pro]' : ''}`)

  // 주문 확인 이메일 발송 (키 N개면 한 통에 모두 표시)
  try {
    await sendEmail({
      to: userEmail,
      subject: keys.length > 1
        ? `Your ${product?.name ?? 'CoreZent'} License Keys (${keys.length})`
        : `Your ${product?.name ?? 'CoreZent'} License Key`,
      html: orderConfirmationEmailHtml({
        userName,
        productName: product?.name ?? 'CoreZent Product',
        serialKeys: keys.map((k) => k.key),
      }),
    })
    console.log(`[LS Webhook] 주문 확인 이메일 발송: ${userEmail}`)
  } catch (mailErr) {
    console.error('[LS Webhook] 이메일 발송 실패:', mailErr)
  }

  // Google Sheets 라이선스 행 추가 — 키별 1행 (상태 '활성', Pro면 G열 TRUE)
  for (const { key } of keys) {
    try {
      await appendLicenseRow({
        email: userEmail,
        serialKey: key,
        expiresAt,
        isPro,
        status: '활성',
      })
      console.log(`[LS Webhook] Sheets 라이선스 기입 완료: ${key.slice(0, 8)}... (isPro: ${isPro})`)
    } catch (sheetsErr) {
      console.error('[LS Webhook] Sheets 기입 실패:', sheetsErr)
    }
  }
}

// ─── 상태값 변환 ─────────────────────────────────────────────────────────────

function mapLSSubStatus(lsStatus: string): string {
  const map: Record<string, string> = {
    active:   'active',
    paused:   'paused',
    cancelled: 'cancelled',
    expired:  'expired',
    past_due: 'active',
    trialing: 'active',
    unpaid:   'paused',
  }
  return map[lsStatus] ?? 'active'
}
