/**
 * @파일: admin/users/page.tsx
 * @설명: 관리자 사용자 관리 — 서버사이드 검색·정렬·페이지 나누기(20명/페이지).
 *        전에는 전 회원+전 주문을 통째로 클라이언트에 내려보냈다 — 수백 명이 되면
 *        무너지는 구조라, 조회는 query.ts(단일 출처 — CSV 내보내기와 공유)로 옮기고
 *        이 페이지는 현재 페이지 분량만 받아 넘긴다. 검색·정렬 조건은 주소(searchParams)에 담긴다.
 */

import type { Metadata } from 'next'
import { parsePageParam } from '@/lib/validate'
import { fetchUserList, type UserSort } from './query'
import UserTable from './UserTable'

export const dynamic = 'force-dynamic'

// 탭 제목 — 루트 title.template이 브랜드를 붙이므로 페이지명만 지정(자매 화면 관례)
export const metadata: Metadata = {
  title: '사용자 관리',
}

const PAGE_SIZE = 20

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>
}) {
  const sp = await searchParams
  const page = parsePageParam(sp.page)
  const q = (sp.q ?? '').trim().slice(0, 80)
  const sort: UserSort = sp.sort === 'name' ? 'name' : 'joined'

  const { users, total } = await fetchUserList({
    q,
    sort,
    page,
    pageSize: PAGE_SIZE,
    withOrders: true,
  })

  return <UserTable users={users} total={total} page={page} pageSize={PAGE_SIZE} q={q} sort={sort} />
}
