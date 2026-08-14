/**
 * @파일: admin/users/query.ts
 * @설명: 관리자 사용자 목록의 조회 단일 출처 — 목록 화면(page.tsx)과 CSV 내보내기
 *        (actions.ts)가 같은 검색·정렬 조건을 쓰도록 여기 한 곳에 둔다(사본 금지).
 *        서버 전용(createAdminClient) — 클라이언트에서 import 금지.
 *        검색: 이름(profiles.name ilike) + 이메일(auth 목록에서 부분 일치) 합집합.
 *        이메일은 auth.admin.listUsers 1페이지(1000명)까지만 — 그 이상은 알려진 한계.
 */

import { createAdminClient } from '@/lib/supabase/admin'

/** 정렬 종류 — joined: 가입일 최신순(기본) / name: 이름 가나다순 */
export type UserSort = 'joined' | 'name'

export interface UserOrderRow {
  id: string
  user_id: string
  amount: number
  status: string
  created_at: string
  cancelReason: string | null
}

export interface UserListRow {
  id: string
  name: string
  email: string
  role: string
  created_at: string
  status: string
  hasPayout: boolean
  orders: UserOrderRow[]
}

/**
 * @함수명: fetchUserList
 * @설명: 검색·정렬 조건에 맞는 회원 목록을 조회합니다. page를 주면 그 페이지만,
 *        주지 않으면 조건에 맞는 전체(CSV용)를 돌려줍니다.
 * @매개변수: opts - q(검색어)·sort(정렬)·page/pageSize(선택)·withOrders(주문 포함 여부)
 * @반환값: { users, total } — total은 조건에 맞는 전체 인원
 */
export async function fetchUserList(opts: {
  q: string
  sort: UserSort
  page?: number
  pageSize?: number
  withOrders?: boolean
}): Promise<{ users: UserListRow[]; total: number }> {
  const adminClient = createAdminClient()
  const q = opts.q.trim()

  // 이메일 맵 — 표시·검색 공용(기존 관례와 동일한 1000명 한도)
  let emailMap = new Map<string, string>()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 이메일 없이도 목록은 그린다 */ }

  // 검색 — 이름 매칭(id)과 이메일 매칭(id)의 합집합. 대상 0명이면 빈 결과.
  let idFilter: string[] | null = null
  if (q) {
    // LIKE 와일드카드(%·_·\)는 이스케이프해 글자 그대로 찾는다(관리자 로그 화면과 같은 규칙)
    const likeSafe = q.slice(0, 80).replace(/[\\%_]/g, (m) => `\\${m}`)
    const ids = new Set<string>()
    const { data: nameRows } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('name', `%${likeSafe}%`)
    ;(nameRows ?? []).forEach((r) => ids.add(r.id))
    const lowered = q.toLowerCase()
    for (const [id, email] of emailMap) {
      if (email.toLowerCase().includes(lowered)) ids.add(id)
    }
    idFilter = [...ids]
    if (idFilter.length === 0) return { users: [], total: 0 }
  }

  // 본 조회 — 정렬·(선택) 페이지
  let query = adminClient
    .from('profiles')
    .select('id, name, role, created_at, status, payout_account_number', { count: 'exact' })
  if (idFilter) query = query.in('id', idFilter)
  query = opts.sort === 'name'
    ? query.order('name', { ascending: true, nullsFirst: false })
    : query.order('created_at', { ascending: false })
  if (opts.page && opts.pageSize) {
    const offset = (opts.page - 1) * opts.pageSize
    query = query.range(offset, offset + opts.pageSize - 1)
  }
  const { data: profiles, count } = await query
  const rows = profiles ?? []

  // 주문 — 이번에 돌려줄 사용자 것만 조회(전 회원 주문을 통째로 받지 않는다)
  const ordersMap = new Map<string, UserOrderRow[]>()
  if (opts.withOrders && rows.length > 0) {
    const pageIds = rows.map((p) => p.id)
    const { data: orders } = await adminClient
      .from('orders')
      .select('id, user_id, amount, status, created_at')
      .in('user_id', pageIds)
      .order('created_at', { ascending: false })

    // 구독 취소 사유 — 이 주문들 것만
    const orderIds = (orders ?? []).map((o) => o.id)
    const cancelReasonMap = new Map<string, string>()
    if (orderIds.length > 0) {
      const { data: cancelledSubs } = await adminClient
        .from('subscriptions')
        .select('order_id, cancellation_reason')
        .in('order_id', orderIds)
        .not('cancellation_reason', 'is', null)
      ;(cancelledSubs ?? []).forEach((s) => {
        if (s.order_id && s.cancellation_reason) {
          cancelReasonMap.set(s.order_id as string, s.cancellation_reason as string)
        }
      })
    }

    ;(orders ?? []).forEach((o) => {
      if (!ordersMap.has(o.user_id)) ordersMap.set(o.user_id, [])
      ordersMap.get(o.user_id)!.push({ ...o, cancelReason: cancelReasonMap.get(o.id) ?? null })
    })
  }

  const users: UserListRow[] = rows.map((p) => ({
    id:         p.id,
    name:       p.name ?? '',
    email:      emailMap.get(p.id) ?? '—',
    role:       p.role ?? 'user',
    created_at: p.created_at,
    status:     (p.status as string) ?? 'active',
    hasPayout:  !!(p.payout_account_number as string | null),
    orders:     ordersMap.get(p.id) ?? [],
  }))

  return { users, total: count ?? users.length }
}
