'use server'

/**
 * @파일: admin/orders/[id]/actions.ts
 * @설명: 관리자 주문 상세의 환불/구독취소 서버 액션 — 실제 돈·구독이 움직이는 동작.
 *        환불: LS POST /v1/orders/{id}/refund (전액), 구독취소: LS DELETE /v1/subscriptions/{id}.
 *        DB 상태는 즉시 반영(UI 피드백)하되, 라이선스/커미션 등 나머지 캐스케이드는
 *        기존 LS 웹훅(order_refunded / subscription_cancelled)이 멱등하게 처리한다(웹훅 로직 미변경).
 *        admin 클라이언트(SERVICE_ROLE)와 권한 검증은 서버 전용 이 파일에서만.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logAdminActivity } from '@/lib/adminActivityLog'

export type ActionResult = { ok: true } | { ok: false; error: string }

/** 호출자가 admin인지 검증하고, 맞으면 admin 클라이언트+userId를 반환 (돈 움직이는 액션의 방어선) */
async function assertAdmin(): Promise<{ ok: true; admin: SupabaseClient; userId: string } | { ok: false }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { ok: false }
  return { ok: true, admin, userId: user.id }
}

/**
 * @함수명: refundOrder
 * @설명: 주문을 Lemon Squeezy에서 전액 환불하고, 주문 상태를 refunded로 반영합니다.
 *        (라이선스 revoke·커미션 반전은 LS가 되쏘는 order_refunded 웹훅이 멱등 처리)
 * @매개변수: orderId - 내부 orders.id (UUID)
 * @반환값: { ok: true } 또는 { ok: false, error }
 */
export async function refundOrder(orderId: string): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return { ok: false, error: '권한이 없습니다.' }
  const admin = auth.admin

  const { data: order } = await admin
    .from('orders')
    .select('id, status, lemon_squeezy_order_id')
    .eq('id', orderId)
    .single()

  if (!order) return { ok: false, error: '주문을 찾을 수 없습니다.' }
  if (order.status === 'refunded') return { ok: false, error: '이미 환불된 주문입니다.' }
  if (!order.lemon_squeezy_order_id) return { ok: false, error: 'Lemon Squeezy order_id가 없어 환불할 수 없습니다.' }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  if (!apiKey) return { ok: false, error: 'LEMONSQUEEZY_API_KEY가 설정되지 않았습니다.' }

  try {
    // 전액 환불 — amount 생략(부분환불 미사용). JSON:API 바디.
    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/orders/${order.lemon_squeezy_order_id}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: { type: 'orders', id: String(order.lemon_squeezy_order_id), attributes: {} },
        }),
      },
    )

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[admin refund] LS API error:', res.status, body.slice(0, 300))
      return { ok: false, error: `환불에 실패했습니다. (LS ${res.status})` }
    }
  } catch (err) {
    console.error('[admin refund] error:', err)
    return { ok: false, error: '환불 요청 중 오류가 발생했습니다.' }
  }

  // 즉시 UI 반영용 상태만 갱신(웹훅이 동일하게 refunded로 되쏘므로 멱등)
  await admin.from('orders').update({ status: 'refunded' }).eq('id', orderId)

  await logAdminActivity({
    adminUserId: auth.userId,
    action: 'order.refund',
    targetType: 'order',
    targetId: orderId,
    detail: { previousStatus: order.status, lemonSqueezyOrderId: order.lemon_squeezy_order_id },
  })

  revalidatePath(`/admin/orders/${orderId}`)
  return { ok: true }
}

/**
 * @함수명: cancelSubscriptionForOrder
 * @설명: 주문에 연결된 구독을 Lemon Squeezy에서 취소(기간 말 종료)하고 상태를 cancelled로 반영합니다.
 *        (기존 사용자 취소 라우트와 동일한 LS DELETE 경로. subscription_cancelled 웹훅이 멱등 처리)
 * @매개변수: orderId - 내부 orders.id (UUID)
 * @반환값: { ok: true } 또는 { ok: false, error }
 */
export async function cancelSubscriptionForOrder(orderId: string): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return { ok: false, error: '권한이 없습니다.' }
  const admin = auth.admin

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, status, lemon_squeezy_subscription_id')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!sub) return { ok: false, error: '연결된 구독이 없습니다.' }
  if (sub.status === 'cancelled' || sub.status === 'expired') {
    return { ok: false, error: '이미 취소/만료된 구독입니다.' }
  }
  if (!sub.lemon_squeezy_subscription_id) {
    return { ok: false, error: 'Lemon Squeezy subscription_id가 없어 취소할 수 없습니다.' }
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  if (!apiKey) return { ok: false, error: 'LEMONSQUEEZY_API_KEY가 설정되지 않았습니다.' }

  try {
    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${sub.lemon_squeezy_subscription_id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
      },
    )

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[admin cancel sub] LS API error:', res.status, body.slice(0, 300))
      return { ok: false, error: `구독 취소에 실패했습니다. (LS ${res.status})` }
    }
  } catch (err) {
    console.error('[admin cancel sub] error:', err)
    return { ok: false, error: '구독 취소 요청 중 오류가 발생했습니다.' }
  }

  await admin
    .from('subscriptions')
    .update({ status: 'cancelled', cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('id', sub.id)

  await logAdminActivity({
    adminUserId: auth.userId,
    action: 'subscription.cancel',
    targetType: 'subscription',
    targetId: sub.id,
    detail: { orderId, previousStatus: sub.status },
  })

  revalidatePath(`/admin/orders/${orderId}`)
  return { ok: true }
}
