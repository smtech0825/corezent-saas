/**
 * @파일: api/orders/bank-transfer/route.ts
 * @설명: 계좌이체(무통장 입금) 주문 생성 — 로그인 필수.
 *        세션 이메일과 입금자 이메일을 재검증(대소문자 무시·trim)하고, product_prices에서 금액을
 *        서버측으로 스냅샷해 status='pending_deposit' 주문을 생성한다(입금 기한 +3일).
 *        라이선스는 발급하지 않는다(운영자가 입금 확인 후 수동 발송). 관리자 알림 메일은 best-effort.
 *        ⚠️ 044_orders_bank_transfer 마이그레이션이 적용돼야 동작한다(payment_method·deposit_* 컬럼).
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyNewOrder } from '@/lib/admin-notify'
import { formatKRW } from '@/lib/money'
import { NextResponse } from 'next/server'

const DEPOSIT_WINDOW_DAYS = 3

export async function POST(request: Request) {
  try {
    const { productPriceId, quantity, depositorEmail } = (await request.json()) as {
      productPriceId?: string
      quantity?: number
      depositorEmail?: string
    }

    if (!productPriceId || typeof productPriceId !== 'string') {
      // error 값은 결제창에 그대로 표시된다 — 손님이 읽는 문구이므로 한국어로 둔다(code는 그대로).
      return NextResponse.json({ error: '주문 정보가 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.', code: 'INVALID' }, { status: 400 })
    }
    const qty = Math.trunc(Number(quantity ?? 1))
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
      return NextResponse.json({ error: '수량은 1개 이상 100개 이하로 입력해 주세요.', code: 'INVALID_QTY' }, { status: 400 })
    }

    // 1. 로그인 사용자 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 풀렸습니다. 다시 로그인한 뒤 시도해 주세요.', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    // 2. 입금자 이메일 = 세션 이메일 재검증(대소문자 무시·trim) — 본인 확인
    const sessionEmail = (user.email ?? '').trim().toLowerCase()
    const enteredEmail = (depositorEmail ?? '').trim().toLowerCase()
    if (!enteredEmail || enteredEmail !== sessionEmail) {
      return NextResponse.json({ error: '가입 시 사용한 이메일을 입력해 주세요.', code: 'EMAIL_MISMATCH' }, { status: 400 })
    }

    // 3. 옵션·금액을 서버측에서 스냅샷(클라이언트 금액 신뢰 안 함)
    const admin = createAdminClient()
    const { data: price, error: priceErr } = await admin
      .from('product_prices')
      .select('id, price, is_active, product_id, type, interval, option_axis1_label, option_axis2_label, products(name)')
      .eq('id', productPriceId)
      .maybeSingle()
    if (priceErr || !price || price.is_active === false) {
      return NextResponse.json({ error: '상품 옵션을 찾을 수 없습니다.', code: 'PRICE_NOT_FOUND' }, { status: 404 })
    }

    // product_prices.price 는 "원 정수"(예 9900). orders.amount 는 "cents"(×100). 수량만큼 곱한다.
    const priceWon = Number(price.price) || 0
    const amountCents = Math.round(priceWon * 100) * qty
    const expiresAt = new Date(Date.now() + DEPOSIT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { data: order, error: insErr } = await admin
      .from('orders')
      .insert({
        user_id: user.id,
        product_price_id: price.id,
        quantity: qty,
        amount: amountCents,
        currency: 'KRW',
        status: 'pending_deposit',
        payment_method: 'bank_transfer',
        depositor_email: user.email ?? enteredEmail,
        deposit_expires_at: expiresAt,
      })
      .select('id')
      .single()
    if (insErr || !order) {
      console.error('[orders/bank-transfer] insert error:', insErr)
      return NextResponse.json({ error: '주문 생성에 실패했습니다.', code: 'DB_ERROR' }, { status: 500 })
    }

    // 4. 관리자 알림 — 공용 헬퍼(admin-notify) 한 곳으로 통일. 수신 주소는 설정
    //    (front_settings.support_email)에서 읽고, 실패는 헬퍼가 전부 삼키므로
    //    주문 흐름은 어떤 경우에도 진행된다. (기존 인라인 발송을 교체 — 두 통 방지)
    const prodRaw = (price as Record<string, unknown>).products
    const prod = (Array.isArray(prodRaw) ? prodRaw[0] : prodRaw) as { name?: string } | null
    const opts = [price.option_axis1_label, price.option_axis2_label].filter(Boolean).join(' · ')
    await notifyNewOrder({
      orderId: order.id,
      productName: `${prod?.name ?? '-'}${opts ? ` (${opts})` : ''}`,
      quantity: qty,
      // 주문 행에 저장한 값(amountCents) 그대로 표시 — 재계산 없음, 관리자 화면과 같은 형식
      amountLabel: formatKRW(amountCents),
      buyerEmail: user.email ?? enteredEmail,
      method: 'bank_transfer',
      status: '입금 대기(pending_deposit)',
      extra: [['입금 기한', expiresAt]],
    })

    return NextResponse.json({ ok: true, orderId: order.id })
  } catch (err) {
    console.error('[orders/bank-transfer]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
