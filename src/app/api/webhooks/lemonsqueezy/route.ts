/**
 * @파일: app/api/webhooks/lemonsqueezy/route.ts
 * @설명: Lemon Squeezy 웹훅 핸들러
 *        주문/구독 이벤트를 수신하여 DB(orders, licenses, subscriptions)에 동기화합니다.
 *
 * 처리하는 이벤트:
 *   - order_created              → orders + licenses 생성
 *   - subscription_created       → subscriptions 생성
 *   - subscription_updated       → 구독 상태/만료일 업데이트 + license.expires_at 동기화
 *   - subscription_cancelled     → 취소 처리 + license expired
 *   - subscription_expired       → 만료 처리 + license expired
 *   - subscription_payment_failed → 결제 실패 → license expired + Sheets 중지
 *   - subscription_paused/unpaused → 일시정지/해제
 *   - order_refunded             → 환불 처리
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

export const runtime = 'nodejs'

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
      case 'subscription_payment_failed':
        await handlePaymentFailed(payload)
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

// ─── 구독 ID로 연결된 라이선스 시리얼 키 조회 (Sheets 업데이트용) ─────────────

async function findLicenseByLsSubId(lsSubId: string): Promise<{ serialKey: string; licenseId: string; orderId: string } | null> {
  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('order_id')
    .eq('lemon_squeezy_subscription_id', lsSubId)
    .single()
  if (!sub?.order_id) return null

  const { data: lic } = await admin
    .from('licenses')
    .select('id, serial_key')
    .eq('order_id', sub.order_id)
    .single()
  if (!lic) return null

  return { serialKey: lic.serial_key, licenseId: lic.id, orderId: sub.order_id }
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
    console.error(`[LS Webhook] 사용자 없음: ${attrs.user_email}`)
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
    console.error(`[LS Webhook] variant_id ${variantId}에 매칭되는 상품 없음. 주문만 기록.`)
  }

  const orderInsert: Record<string, unknown> = {
    user_id: userId,
    lemon_squeezy_order_id: lsOrderId,
    status: 'paid',
    amount: attrs.total,
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

  if (productPriceId && productId && productPrice?.type === 'one_time') {
    await createLicense(userId, order.id, productId, attrs.user_email, attrs.user_name)
  }
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
    console.error(`[LS Webhook] 구독 사용자 없음: ${attrs.user_email}`)
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
    await createLicense(userId, orderId, productPrice.product_id, attrs.user_email, attrs.user_name)
  }
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

  // 라이선스 조회 (Sheets 업데이트 + DB 동기화)
  const licInfo = await findLicenseByLsSubId(lsSubId)

  // 구독 갱신 시 → license.expires_at 동기화 + Sheets 만료일 갱신 + 상태 '활성'
  if (attrs.renews_at && licInfo) {
    try {
      // DB license.expires_at를 구독 갱신일과 동기화
      await admin
        .from('licenses')
        .update({ expires_at: attrs.renews_at, status: 'active' })
        .eq('id', licInfo.licenseId)

      await updateLicenseExpiry({ serialKey: licInfo.serialKey, expiresAt: attrs.renews_at })

      // 구독이 active이면 Sheets 상태도 '활성' 유지
      if (newStatus === 'active') {
        await updateLicenseStatus({ serialKey: licInfo.serialKey, status: '활성' })
      }

      console.log(`[LS Webhook] 라이선스 만료일 동기화 완료: ${licInfo.serialKey}`)
    } catch (sheetsErr) {
      console.error('[LS Webhook] Sheets/DB 동기화 실패:', sheetsErr)
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

  // 연결된 라이선스 상태도 expired로 변경
  const licInfo = await findLicenseByLsSubId(lsSubId)
  if (licInfo) {
    await admin
      .from('licenses')
      .update({ status: 'expired' })
      .eq('id', licInfo.licenseId)

    try {
      await updateLicenseStatus({ serialKey: licInfo.serialKey, status: '중지' })
      console.log(`[LS Webhook] Sheets 상태 중지 처리 완료: ${licInfo.serialKey}`)
    } catch (sheetsErr) {
      console.error('[LS Webhook] Sheets 상태 업데이트 실패:', sheetsErr)
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

  // 연결된 라이선스 상태도 expired로 변경 + Sheets 중지
  const licInfo = await findLicenseByLsSubId(lsSubId)
  if (licInfo) {
    await admin
      .from('licenses')
      .update({ status: 'expired' })
      .eq('id', licInfo.licenseId)

    try {
      await updateLicenseStatus({ serialKey: licInfo.serialKey, status: '중지' })
      console.log(`[LS Webhook] 결제 실패 → Sheets 중지: ${licInfo.serialKey}`)
    } catch (sheetsErr) {
      console.error('[LS Webhook] Sheets 상태 업데이트 실패:', sheetsErr)
    }
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

  const { data: order, error } = await admin
    .from('orders')
    .update({ status: 'refunded' })
    .eq('lemon_squeezy_order_id', lsOrderId)
    .select('id')
    .single()

  if (error) throw new Error(`환불 처리 실패: ${error.message}`)
  if (!order) return

  const { data: lic } = await admin
    .from('licenses')
    .update({ status: 'revoked' })
    .eq('order_id', order.id)
    .select('serial_key')
    .single()

  await admin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('order_id', order.id)

  console.log(`[LS Webhook] 환불 처리 완료: ${lsOrderId}`)

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
 *        Pro 제품은 Sheets G열에 TRUE 기록.
 */
async function createLicense(
  userId: string,
  orderId: string,
  productId: string,
  userEmail: string,
  userName: string,
) {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('licenses')
    .select('id, serial_key')
    .eq('order_id', orderId)
    .single()

  if (existing) {
    console.log(`[LS Webhook] 라이선스 이미 존재: ${existing.id}`)
    return
  }

  const { data: product } = await admin
    .from('products')
    .select('name, max_devices, license_duration_days')
    .eq('id', productId)
    .single()

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

  // Pro 제품 감지 (제품명에 'pro'가 포함되면 Pro로 판별)
  const isPro = (product?.name ?? '').toLowerCase().includes('pro')

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
    console.error('[LS Webhook] 이메일 발송 실패:', mailErr)
  }

  // Google Sheets 라이선스 행 추가 (상태 '활성', Pro면 G열 TRUE)
  try {
    await appendLicenseRow({
      email: userEmail,
      serialKey,
      expiresAt,
      isPro,
      status: '활성',
    })
    console.log(`[LS Webhook] Sheets 라이선스 기입 완료: ${serialKey} (isPro: ${isPro})`)
  } catch (sheetsErr) {
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
    past_due: 'active',
    trialing: 'active',
    unpaid:   'paused',
  }
  return map[lsStatus] ?? 'active'
}
