/**
 * @파일: admin/users/page.tsx
 * @설명: 관리자 사용자 관리 — 서버에서 전체 데이터 수집 후 클라이언트로 전달
 */

import { createAdminClient } from '@/lib/supabase/admin'
import UserTable from './UserTable'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const adminClient = createAdminClient()

  // 프로필 전체 조회 (status 포함)
  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, name, role, country, created_at, status')
    .order('created_at', { ascending: false })

  // Auth 유저 이메일 맵
  let emailMap = new Map<string, string>()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 무시 */ }

  // 주문 전체 조회 후 user_id별 그룹화
  const { data: orders } = await adminClient
    .from('orders')
    .select('id, user_id, amount, status, created_at')
    .order('created_at', { ascending: false })

  const ordersMap = new Map<string, Array<{ id: string; user_id: string; amount: number; status: string; created_at: string }>>()
  ;(orders ?? []).forEach((o) => {
    if (!ordersMap.has(o.user_id)) ordersMap.set(o.user_id, [])
    ordersMap.get(o.user_id)!.push(o)
  })

  // 구독 취소 사유 — order_id 기준 매핑 (UserTable 아코디언에서 표시용)
  const { data: cancelledSubs } = await adminClient
    .from('subscriptions')
    .select('order_id, cancellation_reason')
    .not('cancellation_reason', 'is', null)

  const cancelReasonMap = new Map<string, string>()
  ;(cancelledSubs ?? []).forEach((s) => {
    if (s.order_id && s.cancellation_reason) {
      cancelReasonMap.set(s.order_id as string, s.cancellation_reason as string)
    }
  })

  const users = (profiles ?? []).map((p) => ({
    id:         p.id,
    name:       p.name ?? '',
    email:      emailMap.get(p.id) ?? '—',
    role:       p.role ?? 'user',
    country:    p.country ?? '',
    created_at: p.created_at,
    status:     (p.status as string) ?? 'active',
    orders:     (ordersMap.get(p.id) ?? []).map((o) => ({
      ...o,
      cancelReason: cancelReasonMap.get(o.id) ?? null,
    })),
  }))

  return <UserTable users={users} />
}
