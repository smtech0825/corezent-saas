/**
 * @파일: admin/activity/page.tsx
 * @설명: 관리자 작업 기록 — admin_activity_log(마이그레이션 049) 조회 화면.
 *        "누가(관리자)·무엇을(동작)·언제(시각)·어떻게(전값→후값)" 를 보여준다.
 *        필터(누가·종류·기간)·검색·페이지 나누기는 admin/logs와 같은 서버 방식
 *        (searchParams + range + 공용 Pagination + parsePageParam). 필터 pill·주소 조립은
 *        공용 부품(ListFilterParts), 라벨 데이터는 action-labels.ts. 테이블 미적용 시 안내.
 *        ★ 이 화면은 읽기 전용이다 — 기록을 지우거나 고치는 코드가 없어야 한다.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrThrow } from '@/lib/require-admin'
import { parsePageParam } from '@/lib/validate'
import PageContainer from '@/components/common/PageContainer'
import EmptyState from '@/components/common/EmptyState'
import Pagination from '@/components/common/Pagination'
import { FilterPills, makeListHref, firstParam as first, fmtLogDateTime as fmtDateTime } from '@/app/admin/_components/ListFilterParts'
import { ACTION_LABELS, KIND_OPTIONS, DAYS_OPTIONS } from './action-labels'

export const dynamic = 'force-dynamic'

export const metadata = { title: '작업 기록' }

const PAGE_SIZE = 20
const BASE_PATH = '/admin/activity'

interface ActivityRow {
  id: string
  admin_user_id: string
  action: string
  target_type: string | null
  target_id: string | null
  detail: Record<string, unknown> | null
  created_at: string
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // 페이지 본문도 스스로 관리자 여부를 확인한다(레이아웃 통과에만 기대지 않는다 — 자매 화면과 동일)
  await requireAdminOrThrow()

  const sp = await searchParams
  const page = parsePageParam(sp.page)
  const kind = KIND_OPTIONS.some((o) => o.value === first(sp.kind)) ? first(sp.kind) : ''
  const days = DAYS_OPTIONS.some((o) => o.value === first(sp.days)) ? first(sp.days) : ''
  // 검색어 — PostgREST or() 구분자(콤마·괄호)는 공백 치환, LIKE 와일드카드(%·_·\)는 이스케이프,
  // *(PostgREST가 %로 해석)는 공백 치환 → 입력 글자를 '문자 그대로' 찾는다 (admin/logs와 동일)
  const q = first(sp.q)
    .trim()
    .slice(0, 80)
    .replace(/[,()*]/g, ' ')
    .replace(/[\\%_]/g, (m) => `\\${m}`)
    .trim()

  const admin = createAdminClient()

  // '누가' 필터 선택지 — 현재 관리자 목록(기록의 주체는 관리자뿐). 조회 실패 시 필터만 생략.
  // 한계: 역할이 바뀐 과거 관리자는 선택지에 없다(표의 이름은 아래 nameMap이 id 기준으로 채운다).
  let adminOptions: { value: string; label: string }[] = [{ value: '', label: '전체' }]
  try {
    const { data: admins } = await admin
      .from('profiles')
      .select('id, name')
      .eq('role', 'admin')
      .order('name', { ascending: true })
    adminOptions = adminOptions.concat(
      (admins ?? []).map((a) => ({ value: a.id as string, label: (a.name as string) || `${String(a.id).slice(0, 8)}…` })),
    )
  } catch { /* 선택지 없이도 화면은 동작 */ }
  const who = adminOptions.some((o) => o.value === first(sp.who)) ? first(sp.who) : ''

  const params = { who, kind, days, q, page: String(page) }
  const makeHref = (patch: Record<string, string>) => makeListHref(BASE_PATH, params, patch)

  let query = admin
    .from('admin_activity_log')
    .select('id, admin_user_id, action, target_type, target_id, detail, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (who) query = query.eq('admin_user_id', who)
  if (kind) query = query.like('action', `${kind}.%`)
  if (days) query = query.gte('created_at', new Date(Date.now() - Number(days) * 86400000).toISOString())
  if (q) query = query.or(`action.ilike.%${q}%,target_type.ilike.%${q}%,target_id.ilike.%${q}%`)

  const offset = (page - 1) * PAGE_SIZE
  const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1)

  const rows = (data ?? []) as ActivityRow[]
  const total = count ?? 0
  const hasFilter = Boolean(who || kind || days || q)

  // 행 주체 이름 — 이 페이지에 나온 관리자 id만 모아 한 번에 조회(과거 관리자도 이름이 나온다)
  const nameMap = new Map<string, string>()
  try {
    const ids = [...new Set(rows.map((r) => r.admin_user_id))]
    if (ids.length > 0) {
      const { data: profs } = await admin.from('profiles').select('id, name').in('id', ids)
      ;(profs ?? []).forEach((p) => nameMap.set(p.id as string, (p.name as string) || ''))
    }
  } catch { /* 이름 없이 id 일부만 표시 */ }
  const displayName = (id: string) => nameMap.get(id) || `${id.slice(0, 8)}…`

  return (
    <PageContainer variant="admin" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">작업 기록</h1>
        <p className="text-sm text-ink-soft mt-1">관리자가 무엇을 언제 바꿨는지의 기록입니다. 읽기 전용이며 고치거나 지울 수 없습니다.</p>
      </div>

      <>
        {/* 필터 — 기본값은 전부 '전체'. 조회가 실패해도 항상 렌더(필터로 빠져나올 수 있게) */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <FilterPills basePath={BASE_PATH} label="누가" options={adminOptions} current={who} paramKey="who" params={params} />
          <FilterPills basePath={BASE_PATH} label="종류" options={KIND_OPTIONS} current={kind} paramKey="kind" params={params} />
          <FilterPills basePath={BASE_PATH} label="기간" options={DAYS_OPTIONS} current={days} paramKey="days" params={params} />
          {/* 검색 — GET 폼이라 서버 컴포넌트에서 동작. 동작 코드·대상 안 글자로 찾는다 */}
          <form action={BASE_PATH} method="get" className="flex items-center gap-1.5">
            {who && <input type="hidden" name="who" value={who} />}
            {kind && <input type="hidden" name="kind" value={kind} />}
            {days && <input type="hidden" name="days" value={days} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="동작·대상 검색"
              aria-label="작업 기록 검색"
              className="w-44 bg-paper border border-rule rounded-full px-3 py-1 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-full text-xs border border-rule text-ink-soft hover:text-ink hover:border-mark/40 transition-colors cursor-pointer"
            >
              찾기
            </button>
          </form>
        </div>

        {/* 조회 실패는 두 갈래로 안내 — 테이블 없음(42P01)만 마이그레이션 안내, 그 외는 일반 안내 */}
        {error ? (
          error.code === '42P01' ? (
            <div className="border border-caution/20 bg-caution-soft rounded-card p-5 text-sm text-caution">
              작업 기록 테이블이 아직 준비되지 않았습니다. 마이그레이션{' '}
              <span className="font-mono text-ink">049_admin_activity_log.sql</span> 을 Supabase에 적용해 주세요.
            </div>
          ) : (
            <div className="border border-caution/20 bg-caution-soft rounded-card p-5 text-sm text-caution">
              기록을 불러오지 못했습니다. 잠시 후 다시 시도하거나 필터를 &ldquo;전체&rdquo;로 되돌려 보세요.
            </div>
          )
        ) : (
          <>
            {rows.length === 0 ? (
              <EmptyState
                boxed
                message={
                  total > 0
                    ? '이 페이지 번호에는 기록이 없습니다. 아래 버튼으로 처음 페이지로 이동해 보세요.'
                    : hasFilter
                      ? '조건에 맞는 기록이 없습니다. 필터를 "전체"로 되돌려 보세요.'
                      : '기록된 작업이 없습니다.'
                }
              />
            ) : (
              <div className="border border-rule bg-paper-raised rounded-card overflow-hidden">
                <div className="px-5 py-2.5 border-b border-rule text-xs text-ink-faint">
                  {hasFilter ? '조건에 맞는 기록' : '전체 기록'} {total.toLocaleString('ko-KR')}건 ·{' '}
                  {offset + 1}–{Math.min(offset + PAGE_SIZE, total)}번째 표시
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-rule">
                        <th className="text-left px-5 py-3 text-xs text-ink-faint font-medium">시각</th>
                        <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">누가</th>
                        <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">동작</th>
                        <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">대상</th>
                        <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">내용(전값 → 후값)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        // detail은 기록된 그대로 JSON으로 보여준다(가공·수정 없음). 긴 값은 기록
                        // 시점에 이미 요약돼 있어 여기서 자르는 건 표시 폭 문제일 뿐이다.
                        const detailText = r.detail ? JSON.stringify(r.detail) : ''
                        return (
                          <tr key={r.id} className="border-b border-rule hover:bg-paper-shade transition-colors">
                            <td className="px-5 py-3 text-ink-faint whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                            <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{displayName(r.admin_user_id)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-ink">{ACTION_LABELS[r.action] ?? r.action}</span>
                              <span className="block text-[11px] text-ink-faint font-mono">{r.action}</span>
                            </td>
                            <td className="px-4 py-3 text-ink-soft truncate max-w-[180px]" title={`${r.target_type ?? ''} ${r.target_id ?? ''}`.trim()}>
                              {r.target_type ?? '—'}
                              {r.target_id ? <span className="block text-[11px] text-ink-faint font-mono truncate">{r.target_id}</span> : null}
                            </td>
                            <td className="px-4 py-3 text-ink-soft max-w-[340px]">
                              {detailText ? (
                                <span className="block truncate font-mono text-xs" title={detailText}>{detailText}</span>
                              ) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Pagination
              page={page}
              total={total}
              pageSize={PAGE_SIZE}
              buildHref={(p) => makeHref({ page: String(p) })}
            />
          </>
        )}
      </>
    </PageContainer>
  )
}
