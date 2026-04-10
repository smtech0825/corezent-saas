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

  // expires_at: 레몬스퀴지 subscription_updated 웹훅의 ends_at / renews_at 매핑 필드
  const { data: orders } = await adminClient
    .from('orders')
    .select('id, user_id, amount, status, created_at, expires_at')
    .order('created_at', { ascending: false })

  let emailMap: Map<string, string> = new Map()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 무시 */ }

  const list: Order[] = (orders ?? []).map((o) => ({
    id: o.id as string,
    shortId: (o.id as string).slice(0, 8).toUpperCase(),
    email: emailMap.get(o.user_id as string) ?? '—',
    amount: (o.amount as number) ?? 0,
    status: o.status as string,
    created_at: o.created_at as string,
    // expires_at: DB에 컬럼이 없으면 null 처리
    expires_at: (o as Record<string, unknown>).expires_at as string | null ?? null,
  }))

  const totalRevenue =
    list.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0) / 100

  return <OrderTable orders={list} totalRevenue={totalRevenue} />
}
