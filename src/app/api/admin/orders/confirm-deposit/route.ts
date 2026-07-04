/**
 * @파일: api/admin/orders/confirm-deposit/route.ts
 * @설명: 계좌이체 입금 확인(관리자 전용) — pending_deposit 주문을 status='paid'로 전환하고
 *        deposit_confirmed_at을 기록한다. 라이선스는 자동 발급하지 않는다(운영자 수동 발송).
 *        같은 orders 행이므로 사용자 대시보드에는 별도 동기화 없이 자동 반영된다.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.response

    const { orderId } = (await request.json()) as { orderId?: string }
    if (!orderId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 계좌이체 & 입금 대기 주문만 확인 가능(다른 상태·카드 주문 오확인 방지)
    const { data: order, error: fetchErr } = await admin
      .from('orders')
      .select('id, status, payment_method')
      .eq('id', orderId)
      .maybeSingle()
    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.payment_method !== 'bank_transfer' || order.status !== 'pending_deposit') {
      return NextResponse.json({ error: '입금 대기 상태의 계좌이체 주문이 아닙니다.' }, { status: 400 })
    }

    const { error: updErr } = await admin
      .from('orders')
      .update({ status: 'paid', deposit_confirmed_at: new Date().toISOString() })
      .eq('id', orderId)
    if (updErr) {
      console.error('[confirm-deposit] update error:', updErr)
      return NextResponse.json({ error: '확인 처리에 실패했습니다.' }, { status: 500 })
    }

    revalidatePath('/admin/orders')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[confirm-deposit]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
