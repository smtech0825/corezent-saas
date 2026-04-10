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

  // expires_at은 별도 쿼리로 분리 — DB에 컬럼이 없어도 기본 조회는 항상 성공하도록 보호
  const { data: orders } = await adminClient
    .from('orders')
    .select('id, user_id, amount, status, created_at')
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
    expires_at: null, // DB에 expires_at 컬럼 추가 후 자동 반영
  }))

  const totalRevenue =
    list.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0) / 100

  return <OrderTable orders={list} totalRevenue={totalRevenue} />
}
