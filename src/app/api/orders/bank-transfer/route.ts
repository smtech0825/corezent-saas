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
import { sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

// 관리자 알림 수신 주소(비회원 문의 라우트와 동일 기준)
const ADMIN_EMAIL = 'smtech.semi@gmail.com'
const DEPOSIT_WINDOW_DAYS = 3

export async function POST(request: Request) {
  try {
    const { productPriceId, quantity, depositorEmail } = (await request.json()) as {
      productPriceId?: string
      quantity?: number
      depositorEmail?: string
    }

    if (!productPriceId || typeof productPriceId !== 'string') {
      return NextResponse.json({ error: 'Invalid payload', code: 'INVALID' }, { status: 400 })
    }
    const qty = Math.trunc(Number(quantity ?? 1))
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
      return NextResponse.json({ error: 'Invalid quantity', code: 'INVALID_QTY' }, { status: 400 })
    }

    // 1. 로그인 사용자 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
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

    // 4. 관리자 알림 메일(best-effort — 실패해도 주문 흐름은 진행)
    try {
      const prodRaw = (price as Record<string, unknown>).products
      const prod = (Array.isArray(prodRaw) ? prodRaw[0] : prodRaw) as { name?: string } | null
      const opts = [price.option_axis1_label, price.option_axis2_label].filter(Boolean).join(' · ')
      const shortId = order.id.slice(0, 8).toUpperCase()
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[CoreZent] 계좌이체 입금 대기 주문 #${shortId}`,
        html: `
          <p>새 계좌이체(무통장 입금) 주문이 접수되었습니다. 입금 확인 후 관리자 주문 목록에서 <b>[결제 확인]</b>을 눌러 주세요.</p>
          <p><b>라이선스는 수동 발송이 필요합니다.</b></p>
          <ul>
            <li>주문번호: ${order.id}</li>
            <li>상품: ${prod?.name ?? '-'}${opts ? ` (${opts})` : ''}</li>
            <li>수량: ${qty}</li>
            <li>금액: ₩${(priceWon * qty).toLocaleString('ko-KR')}</li>
            <li>가입 이메일: ${user.email ?? '-'}</li>
            <li>입금 기한: ${expiresAt}</li>
          </ul>`,
      })
    } catch (e) {
      console.error('[orders/bank-transfer] admin email failed (ignored):', e)
    }

    return NextResponse.json({ ok: true, orderId: order.id })
  } catch (err) {
    console.error('[orders/bank-transfer]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
