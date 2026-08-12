/**
 * @파일: admin/logs/page.tsx
 * @설명: 관리자 모니터링 로그 — 이메일 발송(성공/실패)·웹훅 처리 기록 목록.
 *        notification_logs(마이그레이션 034)를 조회한다. 테이블 미적용 시 안내를 표시한다.
 *        필터(종류·상태·기간)·검색·페이지 나누기는 admin/inquiries와 같은 서버 방식
 *        (searchParams + range + 공용 Pagination). 필터 기본값은 전부 '전체' —
 *        기본 화면에서 실패 로그가 가려지는 일이 없도록 한다(지시서 원칙).
 *        ★ 이 화면은 읽기 전용이다 — 로그 행을 지우거나 고치는 코드가 없어야 한다.
 */

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrThrow } from '@/lib/require-admin'
import { parsePageParam } from '@/lib/validate'
import PageContainer from '@/components/common/PageContainer'
import EmptyState from '@/components/common/EmptyState'
import Pagination from '@/components/common/Pagination'
import ErrorSummary, { type ErrorRow } from './ErrorSummary'

export const dynamic = 'force-dynamic'

export const metadata = { title: '모니터링 로그' }

const PAGE_SIZE = 20
// 오류 묶음 요약의 표본 상한 — 기존 화면의 조회 상한(200)과 동일. 상한을 늘리지 않는다
const SUMMARY_LIMIT = 200

// 필터 선택지 — 코드가 실제로 기록하는 값만 넣는다(추측 금지).
// kind: 'email'(lib/email.ts:66,70·api/contact) · 'webhook'(api/webhooks/lemonsqueezy)
// status: 'success' | 'failure' (lib/notification-log.ts 타입)
const KIND_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'email', label: '이메일' },
  { value: 'webhook', label: '웹훅' },
]
const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'success', label: '성공' },
  { value: 'failure', label: '실패' },
]
// 기간 — 기본 '전체': 오래된 실패도 기본 화면에서 가려지지 않는다. 좁혀 볼 때만 선택.
const DAYS_OPTIONS = [
  { value: '', label: '전체' },
  { value: '1', label: '24시간' },
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
]

/** 시각 표기 — 연도 포함(로그는 몇 달치가 쌓이므로 연도가 없으면 시점을 특정할 수 없다) */
function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

interface LogRow {
  id: string
  kind: string
  status: string
  event: string | null
  target: string | null
  error: string | null
  created_at: string
}

/** 현재 필터를 유지한 채 일부 파라미터만 바꾼 주소를 만든다(페이지 이동·필터 전환 공용) */
function makeHref(params: Record<string, string>, patch: Record<string, string>): string {
  const merged = { ...params, ...patch }
  const qs = Object.entries(merged)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return qs ? `/admin/logs?${qs}` : '/admin/logs'
}

/** 필터 pill 한 묶음(종류·상태·기간 공용) — 링크 방식이라 서버 컴포넌트에서 동작 */
function FilterPills({
  label, options, current, paramKey, params,
}: {
  label: string
  options: { value: string; label: string }[]
  current: string
  paramKey: string
  params: Record<string, string>
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-ink-soft shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        {options.map((opt) => {
          const active = current === opt.value
          return (
            <Link
              key={opt.value || 'all'}
              // 필터를 바꾸면 1페이지부터 다시 본다
              href={makeHref(params, { [paramKey]: opt.value, page: '' })}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                active
                  ? 'bg-mark/10 text-mark border-mark/40 font-semibold'
                  : 'text-ink-soft border-rule hover:text-ink hover:border-mark/40'
              }`}
            >
              {opt.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** 같은 파라미터가 두 번 온 주소(?q=a&q=b)에서도 죽지 않게 첫 값만 취한다 */
function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // 페이지 본문도 스스로 관리자 여부를 확인한다(레이아웃 통과에만 기대지 않는다 — 자매 화면과 동일)
  await requireAdminOrThrow()

  const sp = await searchParams
  // 페이지 번호는 공용 파서(상한 포함) — inquiries와 동일
  const page = parsePageParam(sp.page)
  const kind = KIND_OPTIONS.some((o) => o.value === first(sp.kind)) ? first(sp.kind) : ''
  const status = STATUS_OPTIONS.some((o) => o.value === first(sp.status)) ? first(sp.status) : ''
  const days = DAYS_OPTIONS.some((o) => o.value === first(sp.days)) ? first(sp.days) : ''
  // 검색어 — PostgREST or() 구분자(콤마·괄호)는 공백 치환, LIKE 와일드카드(%·_·\)는 이스케이프,
  // *(PostgREST가 %로 해석)는 공백 치환 → 입력 글자를 '문자 그대로' 찾는다
  const q = first(sp.q)
    .trim()
    .slice(0, 80)
    .replace(/[,()*]/g, ' ')
    .replace(/[\\%_]/g, (m) => `\\${m}`)
    .trim()
  const params = { kind, status, days, q, page: String(page) }

  const admin = createAdminClient()
  let query = admin
    .from('notification_logs')
    .select('id, kind, status, event, target, error, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (kind) query = query.eq('kind', kind)
  if (status) query = query.eq('status', status)
  if (days) query = query.gte('created_at', new Date(Date.now() - Number(days) * 86400000).toISOString())
  if (q) query = query.or(`event.ilike.%${q}%,target.ilike.%${q}%,error.ilike.%${q}%`)

  const offset = (page - 1) * PAGE_SIZE
  const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1)

  const logs = (data ?? []) as LogRow[]
  const total = count ?? 0
  const hasFilter = Boolean(kind || status || days || q)

  // 같은 오류 묶음 요약용 — 표와 같은 필터로 실패(오류 있음) 행만 조회. 읽기 전용·상한 동일.
  // '성공'만 보는 중이면 오류 요약은 의미가 없어 조회하지 않는다.
  let summaryRows: ErrorRow[] = []
  if (!error && status !== 'success') {
    let sq = admin
      .from('notification_logs')
      .select('id, kind, event, target, error, created_at')
      .not('error', 'is', null)
      // 방어: "error가 있으면 전부 failure"라는 현재 계약이 코드로 강제되진 않으므로,
      // 성공 행이 오류 요약에 섞이지 않게 이중으로 거른다(표의 상태 필터와 어긋남 방지)
      .neq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(SUMMARY_LIMIT)
    if (kind) sq = sq.eq('kind', kind)
    if (days) sq = sq.gte('created_at', new Date(Date.now() - Number(days) * 86400000).toISOString())
    if (q) sq = sq.or(`event.ilike.%${q}%,target.ilike.%${q}%,error.ilike.%${q}%`)
    const { data: sData } = await sq
    summaryRows = (sData ?? []) as ErrorRow[]
  }

  return (
    <PageContainer variant="admin" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">모니터링 로그</h1>
        <p className="text-sm text-ink-soft mt-1">이메일 발송·웹훅 처리 결과.</p>
      </div>

      <>
          {/* 필터 — 기본값은 전부 '전체'(실패 로그가 기본 화면에서 가려지지 않게).
              조회가 실패해도 항상 렌더 — 문제를 일으킨 검색어·페이지에서 화면만으로 빠져나올 수 있게 */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
            <FilterPills label="종류" options={KIND_OPTIONS} current={kind} paramKey="kind" params={params} />
            <FilterPills label="상태" options={STATUS_OPTIONS} current={status} paramKey="status" params={params} />
            <FilterPills label="기간" options={DAYS_OPTIONS} current={days} paramKey="days" params={params} />
            {/* 검색 — GET 폼이라 서버 컴포넌트에서 동작. 메시지·대상·이벤트 안 글자로 찾는다 */}
            <form action="/admin/logs" method="get" className="flex items-center gap-1.5">
              {kind && <input type="hidden" name="kind" value={kind} />}
              {status && <input type="hidden" name="status" value={status} />}
              {days && <input type="hidden" name="days" value={days} />}
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="메시지·대상 검색"
                aria-label="로그 메시지 검색"
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
                로그 테이블이 아직 준비되지 않았습니다. 마이그레이션{' '}
                <span className="font-mono text-ink">034_notification_logs.sql</span> 을 Supabase에 적용해 주세요.
              </div>
            ) : (
              <div className="border border-caution/20 bg-caution-soft rounded-card p-5 text-sm text-caution">
                로그를 불러오지 못했습니다. 잠시 후 다시 시도하거나 필터를 &ldquo;전체&rdquo;로 되돌려 보세요.
              </div>
            )
          ) : (
            <>
          {/* 같은 오류 묶음 — 접힌 요약, 펼치면 한글 설명·원문 전문·개별 건 전부 */}
          <ErrorSummary rows={summaryRows} limit={SUMMARY_LIMIT} fmt={fmtDateTime} />

          {logs.length === 0 ? (
            <EmptyState
              boxed
              message={
                total > 0
                  ? '이 페이지 번호에는 기록이 없습니다. 아래 버튼으로 처음 페이지로 이동해 보세요.'
                  : hasFilter
                    ? '조건에 맞는 로그가 없습니다. 필터를 "전체"로 되돌려 보세요.'
                    : '기록된 로그가 없습니다.'
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
                      <th className="text-left px-5 py-3 text-xs text-ink-faint font-medium">종류</th>
                      <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">상태</th>
                      <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">이벤트</th>
                      <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">대상</th>
                      <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">오류</th>
                      <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-b border-rule hover:bg-paper-shade transition-colors">
                        <td className="px-5 py-3 text-ink-soft whitespace-nowrap">{l.kind === 'email' ? '이메일' : '웹훅'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            l.status === 'success'
                              ? 'text-ok bg-ok-soft'
                              : 'text-danger bg-danger-soft'
                          }`}>
                            {l.status === 'success' ? '성공' : '실패'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-soft truncate max-w-[200px]">{l.event ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-soft truncate max-w-[180px]">{l.target ?? '—'}</td>
                        <td className="px-4 py-3 text-danger truncate max-w-[240px]" title={l.error ?? ''}>{l.error ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-faint whitespace-nowrap">{fmtDateTime(l.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            buildHref={(p) => makeHref(params, { page: String(p) })}
          />
            </>
          )}
      </>
    </PageContainer>
  )
}
