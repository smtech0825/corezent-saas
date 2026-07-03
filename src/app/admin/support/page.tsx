/**
 * @파일: admin/support/page.tsx
 * @설명: 관리자 지원 티켓 목록 — 상태별 필터, 서버사이드 페이지네이션 (10개/페이지)
 */

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import Pagination from '@/components/common/Pagination'

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
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const adminClient = createAdminClient()

  let query = adminClient
    .from('support_tickets')
    .select('id, user_id, subject, status, priority, is_read, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: tickets, count: total } = await query

  let emailMap: Map<string, string> = new Map()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 무시 */ }

  const list = (tickets ?? []).map((t) => ({
    ...t,
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
    <div className="p-4 sm:p-6 space-y-6">
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

      <div className="border border-rule bg-paper-raised rounded-2xl overflow-hidden">
        {list.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-faint">티켓이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="text-left px-6 py-3 text-xs text-ink-faint font-medium">ID</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">제목</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">사용자</th>
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
    </div>
  )
}
