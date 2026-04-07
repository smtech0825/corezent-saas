/**
 * @파일: app/api/webhooks/lemonsqueezy/route.ts
 * @설명: Lemon Squeezy 웹훅 핸들러
 *        주문/구독 이벤트를 수신하여 DB(orders, licenses, subscriptions)에 동기화합니다.
 *
 * 처리하는 이벤트:
 *   - order_created        → orders + licenses 생성
 *   - subscription_created → subscriptions 생성
 *   - subscription_updated → 구독 상태 업데이트
 *   - subscription_cancelled → 취소 처리
 *   - subscription_expired → 만료 처리
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyLSWebhook,
  generateSerialKey,
  type LSWebhookPayload,
  type LSOrderAttributes,
  type LSSubscriptionAttributes,
} from '@/lib/lemonsqueezy'
import { sendEmail, orderConfirmationEmailHtml } from '@/lib/email'
import { appendLicenseRow, updateLicenseExpiry, updateLicenseStatus } from '@/lib/sheets'

// Vercel Edge에서는 rawBody를 text로 읽어야 서명 검증이 가능
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // 1. 원시 본문 읽기 (서명 검증용)
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature') ?? ''

  // 2. 서명 검증
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
      case 'subscription_paused':
        await handleSubscriptionStatusChange(payload, 'paused')
        break
      case 'subscription_unpaused':
        await handleSubscriptionStatusChange(payload, 'active')
        break
      case 'order_refunded':
        await handleOrderRefunded(payload)
        break
      default:
        console.log(`[LS Webhook] 처리하지 않는 이벤트: ${eventName}`)
    }
  } catch (err) {
    console.error(`[LS Webhook] 이벤트 처리 중 오류 (${eventName}):`, err)
    // 500을 반환하면 LS가 재시도하므로 200으로 응답 (중복 처리 방지)
    return NextResponse.json({ received: true, error: String(err) }, { status: 200 })
  }

  return NextResponse.json({ received: true })
}

// ─── 사용자 조회 ────────────────────────────────────────────────────────────

/**
 * @함수명: findUserId
 * @설명: custom_data.user_id → 이메일 순서로 사용자를 조회합니다.
 */
async function findUserId(
  customUserId: string | undefined,
  email: string,
): Promise<string | null> {
  const admin = createAdminClient()

  // 1순위: 체크아웃 시 주입된 user_id
  if (customUserId) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('id', customUserId)
      .single()
    if (data) return data.id
  }

  // 2순위: 이메일로 auth.users 조회 (helper function 사용)
  const { data } = await admin.rpc('get_user_id_by_email', { p_email: email })
  return data ?? null
}

// ─── order_created 핸들러 ──────────────────────────────────────────────────

async function handleOrderCreated(payload: LSWebhookPayload) {
  const attrs = payload.data.attributes as LSOrderAttributes
  const lsOrderId = String(payload.data.id)

  // paid 상태인 주문만 처리
  if (attrs.status !== 'paid') {
    console.log(`[LS Webhook] 주문 ${lsOrderId} 상태가 paid가 아님: ${attrs.status}`)
    return
  }

  const admin = createAdminClient()

  // 중복 처리 방지
  const { data: existing } = await admin
    .from('orders')
    .select('id')
    .eq('lemon_squeezy_order_id', lsOrderId)
    .single()
  if (existing) {
    console.log(`[LS Webhook] 이미 처리된 주문: ${lsOrderId}`)
    return
  }

  // 사용자 조회
  const userId = await findUserId(
    payload.meta.custom_data?.user_id,
    attrs.user_email,
  )
  if (!userId) {
    console.error(`[LS Webhook] 사용자 없음: ${attrs.user_email}`)
    return
  }

  // variant_id로 product_price 조회
  const variantId = String(attrs.first_order_item?.variant_id)
  const { data: productPrice } = await admin
    .from('product_prices')
    .select('id, product_id, type, interval')
    .eq('lemon_squeezy_variant_id', variantId)
    .single()

  // 번들 조회 시도 (variant_id가 product_prices에 없을 경우)
  let bundleId: string | null = null
  let productPriceId: string | null = productPrice?.id ?? null
  let productId: string | null = productPrice?.product_id ?? null

  if (!productPriceId) {
    // 번들에서 조회
    const { data: bundleData } = await admin
      .from('bundles')
      .select('id')
      .or(`lemon_squeezy_monthly_variant_id.eq.${variantId},lemon_squeezy_annual_variant_id.eq.${variantId}`)
      .single()
    if (bundleData) bundleId = bundleData.id
  }

  if (!productPriceId && !bundleId) {
    console.error(`[LS Webhook] variant_id ${variantId}에 매칭되는 상품 없음. 주문만 기록.`)
  }

  // 주문 생성 (product_price/bundle 미매칭시 lemon_squeezy_order_id로만 기록)
  const orderInsert: Record<string, unknown> = {
    user_id: userId,
    lemon_squeezy_order_id: lsOrderId,
    status: 'paid',
    amount: attrs.total,    // cents
    currency: attrs.currency,
  }
  if (productPriceId) orderInsert.product_price_id = productPriceId
  if (bundleId) orderInsert.bundle_id = bundleId

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert(orderInsert)
    .select('id')
    .single()

  if (orderErr || !order) {
    throw new Error(`주문 생성 실패: ${orderErr?.message}`)
  }

  console.log(`[LS Webhook] 주문 생성 완료: ${order.id}`)

  // 구독형 제품은 subscription_created에서 라이선스 생성
  // 일회성 결제만 여기서 라이선스 생성
  if (productPriceId && productId && productPrice?.type === 'one_time') {
    await createLicense(userId, order.id, productId, attrs.user_email, attrs.user_name)
  }
}

// ─── subscription_created 핸들러 ─────────────────────────────────────────────

async function handleSubscriptionCreated(payload: LSWebhookPayload) {
  const attrs = payload.data.attributes as LSSubscriptionAttributes
  const lsSubId = String(payload.data.id)

  const admin = createAdminClient()

  // 중복 처리 방지
  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('lemon_squeezy_subscription_id', lsSubId)
    .single()
  if (existing) {
    console.log(`[LS Webhook] 이미 처리된 구독: ${lsSubId}`)
    return
  }

  // 사용자 조회
  const userId = await findUserId(
    payload.meta.custom_data?.user_id,
    attrs.user_email,
  )
  if (!userId) {
    console.error(`[LS Webhook] 구독 사용자 없음: ${attrs.user_email}`)
    return
  }

  // variant_id로 product_price 조회
  const variantId = String(attrs.variant_id)
  const { data: productPrice } = await admin
    .from('product_prices')
    .select('id, product_id, interval')
    .eq('lemon_squeezy_variant_id', variantId)
    .single()

  // 번들 조회
  let bundleId: string | null = null
  if (!productPrice) {
    const { data: bundleData } = await admin
      .from('bundles')
      .select('id')
      .or(`lemon_squeezy_monthly_variant_id.eq.${variantId},lemon_squeezy_annual_variant_id.eq.${variantId}`)
      .single()
    if (bundleData) bundleId = bundleData.id
  }

  // LS order_id로 우리 DB 주문 조회 — 없으면 직접 생성 (이벤트 순서 역전 대비)
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
      currency: 'USD',
    }
    if (productPrice) orderInsert.product_price_id = productPrice.id
    if (bundleId) orderInsert.bundle_id = bundleId
    const { data: newOrder } = await admin
      .from('orders')
      .insert(orderInsert)
      .select('id')
      .single()
    orderId = newOrder?.id ?? null
  }

  // billing_interval: product_price.interval 기준
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

  // 구독형 라이선스 생성
  if (productPrice?.product_id && orderId) {
    await createLicense(userId, orderId, productPrice.product_id, attrs.user_email, attrs.user_name)
  }
}

// ─── subscription_updated 핸들러 ─────────────────────────────────────────────

async function handleSubscriptionUpdated(payload: LSWebhookPayload) {
  const attrs = payload.data.attributes as LSSubscriptionAttributes
  const lsSubId = String(payload.data.id)

  const admin = createAdminClient()
  const { error } = await admin
    .from('subscriptions')
    .update({
      status: mapLSSubStatus(attrs.status),
      current_period_end: attrs.renews_at ?? null,
      cancel_at_period_end: attrs.cancelled,
      customer_portal_url: attrs.urls?.customer_portal ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('lemon_squeezy_subscription_id', lsSubId)

  if (error) throw new Error(`구독 업데이트 실패: ${error.message}`)
  console.log(`[LS Webhook] 구독 업데이트 완료: ${lsSubId}`)

  // Google Sheets 만료일 갱신 (구독 갱신 시)
  if (attrs.renews_at) {
    try {
      const { data: sub } = await admin
        .from('subscriptions')
        .select('order_id')
        .eq('lemon_squeezy_subscription_id', lsSubId)
        .single()
      if (sub?.order_id) {
        const { data: lic } = await admin
          .from('licenses')
          .select('serial_key')
          .eq('order_id', sub.order_id)
          .single()
        if (lic?.serial_key) {
          await updateLicenseExpiry({ serialKey: lic.serial_key, expiresAt: attrs.renews_at })
          console.log(`[LS Webhook] Sheets 만료일 갱신 완료: ${lic.serial_key}`)
        }
      }
    } catch (sheetsErr) {
      console.error('[LS Webhook] Sheets 만료일 갱신 실패:', sheetsErr)
    }
  }
}

// ─── subscription_cancelled / expired 핸들러 ─────────────────────────────────

async function handleSubscriptionCancelled(payload: LSWebhookPayload) {
  const attrs = payload.data.attributes as LSSubscriptionAttributes
  const lsSubId = String(payload.data.id)

  const admin = createAdminClient()
  const isCancelled = payload.meta.event_name === 'subscription_cancelled'

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

  // Google Sheets 상태 → 중지
  try {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('order_id')
      .eq('lemon_squeezy_subscription_id', lsSubId)
      .single()
    if (sub?.order_id) {
      const { data: lic } = await admin
        .from('licenses')
        .select('serial_key')
        .eq('order_id', sub.order_id)
        .single()
      if (lic?.serial_key) {
        await updateLicenseStatus({ serialKey: lic.serial_key, status: '중지' })
        console.log(`[LS Webhook] Sheets 상태 중지 처리 완료: ${lic.serial_key}`)
      }
    }
  } catch (sheetsErr) {
    console.error('[LS Webhook] Sheets 상태 업데이트 실패:', sheetsErr)
  }
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

  // 주문 상태를 refunded로 업데이트
  const { data: order, error } = await admin
    .from('orders')
    .update({ status: 'refunded' })
    .eq('lemon_squeezy_order_id', lsOrderId)
    .select('id')
    .single()

  if (error) throw new Error(`환불 처리 실패: ${error.message}`)
  if (!order) return

  // 해당 주문의 라이선스를 revoked로 변경
  const { data: lic } = await admin
    .from('licenses')
    .update({ status: 'revoked' })
    .eq('order_id', order.id)
    .select('serial_key')
    .single()

  // 해당 주문의 구독을 cancelled로 변경
  await admin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('order_id', order.id)

  console.log(`[LS Webhook] 환불 처리 완료: ${lsOrderId}`)

  // Google Sheets 상태 → 중지
  if (lic?.serial_key) {
    try {
      await updateLicenseStatus({ serialKey: lic.serial_key, status: '중지' })
      console.log(`[LS Webhook] Sheets 상태 중지 처리 완료: ${lic.serial_key}`)
    } catch (sheetsErr) {
      console.error('[LS Webhook] Sheets 상태 업데이트 실패:', sheetsErr)
    }
  }
}

// ─── 라이선스 생성 ────────────────────────────────────────────────────────────

/**
 * @함수명: createLicense
 * @설명: 주문/구독 완료 후 고유 시리얼 키를 생성하고 이메일로 발송합니다.
 */
async function createLicense(
  userId: string,
  orderId: string,
  productId: string,
  userEmail: string,
  userName: string,
) {
  const admin = createAdminClient()

  // 이미 이 주문에 라이선스가 있는지 확인
  const { data: existing } = await admin
    .from('licenses')
    .select('id, serial_key')
    .eq('order_id', orderId)
    .single()

  if (existing) {
    console.log(`[LS Webhook] 라이선스 이미 존재: ${existing.id}`)
    return
  }

  // 제품 정보 조회 (max_devices, license_duration_days)
  const { data: product } = await admin
    .from('products')
    .select('name, max_devices, license_duration_days')
    .eq('id', productId)
    .single()

  // 고유 시리얼 키 생성 (충돌 시 재시도)
  let serialKey = generateSerialKey()
  for (let i = 0; i < 5; i++) {
    const { data: dup } = await admin
      .from('licenses')
      .select('id')
      .eq('serial_key', serialKey)
      .single()
    if (!dup) break
    serialKey = generateSerialKey()
  }

  // 만료일 계산
  let expiresAt: string | null = null
  if (product?.license_duration_days) {
    const d = new Date()
    d.setDate(d.getDate() + product.license_duration_days)
    expiresAt = d.toISOString()
  }

  const { data: license, error: licErr } = await admin
    .from('licenses')
    .insert({
      user_id: userId,
      order_id: orderId,
      product_id: productId,
      serial_key: serialKey,
      status: 'active',
      max_devices: product?.max_devices ?? null,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (licErr || !license) {
    throw new Error(`라이선스 생성 실패: ${licErr?.message}`)
  }

  console.log(`[LS Webhook] 라이선스 생성 완료: ${license.id} (${serialKey})`)

  // 주문 확인 이메일 발송
  try {
    await sendEmail({
      to: userEmail,
      subject: `Your ${product?.name ?? 'CoreZent'} License Key`,
      html: orderConfirmationEmailHtml({
        userName,
        productName: product?.name ?? 'CoreZent Product',
        serialKey,
      }),
    })
    console.log(`[LS Webhook] 주문 확인 이메일 발송: ${userEmail}`)
  } catch (mailErr) {
    // 이메일 실패는 무시 (라이선스는 이미 생성됨)
    console.error('[LS Webhook] 이메일 발송 실패:', mailErr)
  }

  // Google Sheets 라이선스 행 추가
  try {
    await appendLicenseRow({ email: userEmail, serialKey, expiresAt })
    console.log(`[LS Webhook] Sheets 라이선스 기입 완료: ${serialKey}`)
  } catch (sheetsErr) {
    // Sheets 실패는 무시 (라이선스는 이미 생성됨)
    console.error('[LS Webhook] Sheets 기입 실패:', sheetsErr)
  }
}

// ─── 상태값 변환 ─────────────────────────────────────────────────────────────

function mapLSSubStatus(lsStatus: string): string {
  const map: Record<string, string> = {
    active:   'active',
    paused:   'paused',
    cancelled: 'cancelled',
    expired:  'expired',
    past_due: 'active',   // past_due는 active로 유지 (결제 재시도 중)
    trialing: 'active',
    unpaid:   'paused',
  }
  return map[lsStatus] ?? 'active'
}
