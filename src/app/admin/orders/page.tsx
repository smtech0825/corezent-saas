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

  // subscriptions JOIN — current_period_end(만료일) + billing_interval(Period) 함께 조회
  const { data: orders } = await adminClient
    .from('orders')
    .select('id, user_id, amount, status, created_at, subscriptions(current_period_end, billing_interval)')
    .order('created_at', { ascending: false })

  let emailMap: Map<string, string> = new Map()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 무시 */ }

  type SubInfo = { current_period_end: string | null; billing_interval: string | null }

  const list: Order[] = (orders ?? []).map((o) => {
    const subs = ((o as Record<string, unknown>).subscriptions as SubInfo[] | null)
    return {
      id:         o.id as string,
      shortId:    (o.id as string).slice(0, 8).toUpperCase(),
      email:      emailMap.get(o.user_id as string) ?? '—',
      amount:     (o.amount as number) ?? 0,
      status:     o.status as string,
      created_at: o.created_at as string,
      // subscriptions.current_period_end → 만료일
      expires_at: subs?.[0]?.current_period_end ?? null,
      // subscriptions.billing_interval → Period (monthly | annual | null)
      period:     subs?.[0]?.billing_interval ?? null,
    }
  })

  const totalRevenue =
    list.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0) / 100

  return <OrderTable orders={list} totalRevenue={totalRevenue} />
}
