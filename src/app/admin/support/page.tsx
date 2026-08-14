/**
 * @파일: admin/support/page.tsx
 * @설명: 관리자 지원 티켓 목록 — 상태별 필터, 서버사이드 페이지네이션 (10개/페이지)
 */

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import Pagination from '@/components/common/Pagination'
import PageContainer from '@/components/common/PageContainer'
import EmptyState from '@/components/common/EmptyState'
import { parsePageParam } from '@/lib/validate'
import { supportCategoryLabel } from '@/lib/support-categories'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })
}

const statusColors: Record<string, string> = {
  open:     'text-caution bg-caution-soft',
  answered: 'text-info bg-info-soft',
  closed:   'text-ink-soft bg-paper-shade',
}

const priorityColors: Record<string, string> = {
  low:    'text-ink-faint',
  normal: 'text-ink-soft',
  high:   'text-caution',
  urgent: 'text-danger',
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const { status, page: pageStr } = await searchParams
  const page = parsePageParam(pageStr)
  const offset = (page - 1) * PAGE_SIZE

  const adminClient = createAdminClient()

  /** 목록 행 공통 형태 — category는 062 적용 전이면 빠질 수 있어 선택 필드 */
  type TicketRow = {
    id: string; user_id: string; subject: string; status: string; priority: string
    category?: string | null; is_read: boolean; created_at: string; updated_at: string
  }

  /**
   * @함수명: fetchTickets
   * @설명: 티켓 목록을 조회합니다. category 칸 포함으로 먼저 시도하고, 칸이 아직
   *        없으면(062 미적용) 빼고 재시도합니다 — 화면이 통째로 비지 않게.
   *        select 문자열은 타입 파싱 때문에 리터럴이어야 해서 두 체인으로 나뉜다.
   * @매개변수: withCategory - category 칸을 select에 포함할지
   * @반환값: supabase 조회 결과 그대로
   */
  async function fetchTickets(withCategory: boolean) {
    if (withCategory) {
      let query = adminClient
        .from('support_tickets')
        .select('id, user_id, subject, status, priority, category, is_read, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      if (status && status !== 'all') query = query.eq('status', status)
      return query
    }
    let query = adminClient
      .from('support_tickets')
      .select('id, user_id, subject, status, priority, is_read, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (status && status !== 'all') query = query.eq('status', status)
    return query
  }

  let res = await fetchTickets(true)
  if (res.error) res = await fetchTickets(false)
  const tickets = (res.data ?? []) as TicketRow[]
  const total = res.count

  let emailMap: Map<string, string> = new Map()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 무시 */ }

  const list = tickets.map((t) => ({
    ...t,
    category: t.category ?? null,
    email: emailMap.get(t.user_id) ?? '—',
    shortId: t.id.slice(0, 8).toUpperCase(),
  }))

  const tabs = [
    { label: '전체',    value: 'all' },
    { label: '열림',    value: 'open' },
    { label: '답변됨',  value: 'answered' },
    { label: '닫힘',    value: 'closed' },
  ]

  const activeTab = status ?? 'all'

  function buildHref(p: number) {
    return `/admin/support?status=${activeTab}&page=${p}`
  }

  return (
    <PageContainer variant="admin" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">고객지원 티켓</h1>
        <p className="text-sm text-ink-soft mt-1">
          티켓 {total ?? 0}개
        </p>
      </div>

      {/* 상태 탭 필터 */}
      <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-1 border border-rule bg-paper-raised rounded-xl p-1 w-max min-w-full sm:w-fit sm:min-w-0">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/support?status=${tab.value}&page=1`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-mark/10 text-mark'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      </div>

      <div className="border border-rule bg-paper-raised rounded-card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState message="티켓이 없습니다." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="text-left px-6 py-3 text-xs text-ink-faint font-medium">ID</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">제목</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">사용자</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">유형</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">우선순위</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">상태</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">날짜</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b border-rule hover:bg-paper-shade transition-colors ${!t.is_read ? 'bg-mark/5' : ''}`}
                  >
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs text-ink-faint">#{t.shortId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${!t.is_read ? 'text-ink' : 'text-ink-soft'}`}>
                        {!t.is_read && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger mr-2 align-middle animate-pulse" />
                        )}
                        {t.subject}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft truncate max-w-[160px]">{t.email}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft whitespace-nowrap">{supportCategoryLabel(t.category)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${priorityColors[t.priority] ?? 'text-ink-soft'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${statusColors[t.status] ?? 'text-ink-soft bg-paper-shade'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-faint whitespace-nowrap">{fmtDate(t.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/support/${t.id}`}
                        className="text-xs text-mark hover:text-ink transition-colors"
                      >
                        보기 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        page={page}
        total={total ?? 0}
        pageSize={PAGE_SIZE}
        buildHref={buildHref}
      />
    </PageContainer>
  )
}
