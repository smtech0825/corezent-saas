/**
 * @파일: admin/orders/page.tsx
 * @설명: 관리자 주문 관리 — 서버에서 전체 데이터 수집 후 클라이언트로 전달
 */

import { createAdminClient } from '@/lib/supabase/admin'
import OrderTable from './OrderTable'
import type { Order } from './OrderTable'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const adminClient = createAdminClient()

  // subscriptions JOIN — current_period_end(만료일) + billing_interval(Period),
  // product_prices JOIN — 상품명 + 선택 옵션(축1/축2 라벨) 함께 조회
  const { data: orders } = await adminClient
    .from('orders')
    .select('id, user_id, amount, currency, status, created_at, payment_method, depositor_email, deposit_expires_at, deposit_confirmed_at, subscriptions(current_period_end, billing_interval), product_prices(option_axis1_label, option_axis2_label, products(name))')
    .order('created_at', { ascending: false })

  let emailMap: Map<string, string> = new Map()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 무시 */ }

  // 구매자 이름(profiles.name) — 이메일과 함께 표시(대체 아님)
  const userIds = [...new Set((orders ?? []).map((o) => o.user_id as string).filter(Boolean))]
  const nameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profs } = await adminClient.from('profiles').select('id, name').in('id', userIds)
    ;(profs ?? []).forEach((p) => nameMap.set(p.id as string, (p.name as string) ?? ''))
  }

  type SubInfo = { current_period_end: string | null; billing_interval: string | null }

  const list: Order[] = (orders ?? []).map((o) => {
    const subs = ((o as Record<string, unknown>).subscriptions as SubInfo[] | null)
    // product_prices(→products) 는 to-one 이지만 PostgREST가 객체/배열로 줄 수 있어 방어적으로 처리
    const ppRaw = (o as Record<string, unknown>).product_prices
    const pp = (Array.isArray(ppRaw) ? ppRaw[0] : ppRaw) as
      { option_axis1_label?: string | null; option_axis2_label?: string | null; products?: unknown } | null
    const prodRaw = pp?.products
    const prod = (Array.isArray(prodRaw) ? prodRaw[0] : prodRaw) as { name?: string } | null
    const optionParts = [pp?.option_axis1_label, pp?.option_axis2_label].filter(Boolean)
    return {
      id:         o.id as string,
      shortId:    (o.id as string).slice(0, 8).toUpperCase(),
      email:      emailMap.get(o.user_id as string) ?? '—',
      name:       nameMap.get(o.user_id as string) ?? '',
      productName: prod?.name ?? '',
      option:     optionParts.join(' · '),
      amount:     (o.amount as number) ?? 0,
      currency:   (o.currency as string) ?? 'KRW',
      status:     o.status as string,
      created_at: o.created_at as string,
      // subscriptions.current_period_end → 만료일
      expires_at: subs?.[0]?.current_period_end ?? null,
      // subscriptions.billing_interval → Period (monthly | annual | null)
      period:     subs?.[0]?.billing_interval ?? null,
      // 계좌이체 대조용(044) — 카드 주문은 기본 'card'
      paymentMethod:  ((o as Record<string, unknown>).payment_method as string) ?? 'card',
      depositorEmail: ((o as Record<string, unknown>).depositor_email as string) ?? null,
      depositExpiresAt: ((o as Record<string, unknown>).deposit_expires_at as string) ?? null,
    }
  })

  // 주문 금액(amount)은 cents — cents로 합산만 하고, ÷100·₩ 표기는 formatKRW에서 한 번(이중 방지).
  const totalRevenue =
    list.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0)

  return <OrderTable orders={list} totalRevenue={totalRevenue} />
}
