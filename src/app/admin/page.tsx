/**
 * @파일: admin/page.tsx
 * @설명: 관리자 대시보드 개요 — 핵심 통계 카드 + 최근 주문/가입 테이블
 *        월간/연간 신규 가입자·매출 서브 지표 + 성장률 추가
 *        Open Tickets 아이콘 → /admin/support 링크
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { formatKRW } from '@/lib/money'
import {
  Users, DollarSign, Key, MessageSquare,
  TrendingUp, UserPlus,
} from 'lucide-react'
import ChurnAnalysis, { type CancelEntry } from './ChurnAnalysis'
import PageContainer from '@/components/common/PageContainer'
import EmptyState from '@/components/common/EmptyState'
import StatCard from '@/components/common/StatCard'
import InitialAvatar from '@/components/common/InitialAvatar'

export const dynamic = 'force-dynamic'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}
// 매출·주문 금액(amount)은 cents — formatKRW가 ÷100 후 ₩ 표기 (단일 출처 lib/money).
function fmtCurrency(n: number) {
  return formatKRW(n)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** 성장률 계산 — 전기 대비 % (전기=0이면 신규 100% 처리) */
function growthRate(current: number, prev: number): number | null {
  if (current === 0 && prev === 0) return null
  if (prev === 0) return 100
  return Math.round(((current - prev) / prev) * 100)
}

/**
 * @함수명: growthDisplay
 * @설명: 증감률을 화면에 보여줄지 정하는 표시 조건. 계산식(growthRate)은 그대로 두고
 *        여기서만 거른다 — 비교할 이전 값이 없으면(전기 0) "신규 100%"는 억지 수치이고,
 *        이번 기간 값이 아직 0이면(월초·연초) "↘100%"가 매달 초 반복되는 소음이라
 *        둘 다 표시하지 않는다(화면에는 – 로 나간다). 양쪽 다 값이 있을 때만 %를 보인다.
 * @매개변수: current - 이번 기간 값 / prev - 이전 기간 값
 * @반환값: 표시할 증감률. 표시하지 않을 때 null
 */
function growthDisplay(current: number, prev: number): number | null {
  if (current <= 0 || prev <= 0) return null
  return growthRate(current, prev)
}

/** 매출 배열 합산 (amount는 센트 — 합산만, ÷100·₩표기는 formatKRW에서) */
function sumAmount(rows: { amount: number | null }[]): number {
  return rows.reduce((s, o) => s + (o.amount ?? 0), 0)
}

const statusColors: Record<string, string> = {
  paid:      'text-ok bg-ok-soft',
  pending:   'text-caution bg-caution-soft',
  refunded:  'text-info bg-info-soft',
  cancelled: 'text-danger bg-danger-soft',
  active:    'text-ok bg-ok-soft',
  open:      'text-caution bg-caution-soft',
  answered:  'text-info bg-info-soft',
  closed:    'text-ink-soft bg-paper-shade',
  admin:     'text-mark bg-mark/10',
  user:      'text-ink-soft bg-paper-shade',
}

/** 주문 상태 표시 라벨 — UserTable.tsx의 한글 라벨과 통일 (paid=결제됨/pending=대기 중/refunded=환불됨/cancelled=취소됨) */
const orderStatusLabel: Record<string, string> = {
  paid:      '결제됨',
  pending:   '대기 중',
  refunded:  '환불됨',
  cancelled: '취소됨',
}

export default async function AdminPage() {
  const adminClient = createAdminClient()

  // ── UTC 기준 날짜 경계 (서버 타임존 무관) ─────────────────────
  const now = new Date()
  const y  = now.getUTCFullYear()
  const m  = now.getUTCMonth()

  const startOfMonth     = new Date(Date.UTC(y, m,     1)).toISOString()
  const startOfPrevMonth = new Date(Date.UTC(y, m - 1, 1)).toISOString()
  const startOfYear      = new Date(Date.UTC(y, 0,     1)).toISOString()
  const startOfPrevYear  = new Date(Date.UTC(y - 1, 0, 1)).toISOString()

  // ── 병렬 쿼리 ────────────────────────────────────────────────
  const [
    userCountRes,
    revenueAllRes,
    licenseCountRes,
    ticketCountRes,
    recentOrdersRes,
    // Users: 이번 달 / 지난달 / 올해 / 작년
    usersMonthRes,
    usersPrevMonthRes,
    usersYearRes,
    usersPrevYearRes,
    // Revenue (paid): 이번 달 / 지난달 / 올해 / 작년
    revMonthRes,
    revPrevMonthRes,
    revYearRes,
    revPrevYearRes,
  ] = await Promise.all([
    adminClient.from('profiles').select('*', { count: 'exact', head: true }),
    adminClient.from('orders').select('amount').eq('status', 'paid'),
    adminClient.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    adminClient.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    adminClient
      .from('orders')
      .select('id, amount, status, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(8),

    // Users 월간/연간
    adminClient.from('profiles').select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth),
    adminClient.from('profiles').select('*', { count: 'exact', head: true })
      .gte('created_at', startOfPrevMonth).lt('created_at', startOfMonth),
    adminClient.from('profiles').select('*', { count: 'exact', head: true })
      .gte('created_at', startOfYear),
    adminClient.from('profiles').select('*', { count: 'exact', head: true })
      .gte('created_at', startOfPrevYear).lt('created_at', startOfYear),

    // Revenue 월간/연간 (paid only)
    adminClient.from('orders').select('amount').eq('status', 'paid')
      .gte('created_at', startOfMonth),
    adminClient.from('orders').select('amount').eq('status', 'paid')
      .gte('created_at', startOfPrevMonth).lt('created_at', startOfMonth),
    adminClient.from('orders').select('amount').eq('status', 'paid')
      .gte('created_at', startOfYear),
    adminClient.from('orders').select('amount').eq('status', 'paid')
      .gte('created_at', startOfPrevYear).lt('created_at', startOfYear),
  ])

  // ── 집계 ─────────────────────────────────────────────────────
  const totalUsers     = userCountRes.count ?? 0
  const totalRevenue   = sumAmount(revenueAllRes.data ?? [])
  const activeLicenses = licenseCountRes.count ?? 0
  const openTickets    = ticketCountRes.count ?? 0
  const recentOrders   = recentOrdersRes.data ?? []

  const newUsersMonth  = usersMonthRes.count ?? 0
  const prevUsersMonth = usersPrevMonthRes.count ?? 0
  const newUsersYear   = usersYearRes.count ?? 0
  const prevUsersYear  = usersPrevYearRes.count ?? 0

  const revMonth     = sumAmount(revMonthRes.data ?? [])
  const prevRevMonth = sumAmount(revPrevMonthRes.data ?? [])
  const revYear      = sumAmount(revYearRes.data ?? [])
  const prevRevYear  = sumAmount(revPrevYearRes.data ?? [])

  // ── 최근 가입자 ───────────────────────────────────────────────
  const { data: recentUsers } = await adminClient
    .from('profiles')
    .select('id, name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  // ── 주문자 이메일 ─────────────────────────────────────────────
  let emailMap: Map<string, string> = new Map()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch {
    // 이메일 조회 실패 시 무시
  }

  // ── 구독 취소 사유 (Churn Analysis) ──────────────────────────
  const { data: cancelledSubs } = await adminClient
    .from('subscriptions')
    .select('cancellation_reason, updated_at, user_id')
    .not('cancellation_reason', 'is', null)
    .order('updated_at', { ascending: false })

  const cancelEntries: CancelEntry[] = (cancelledSubs ?? []).map((s) => ({
    reason:    s.cancellation_reason as string,
    email:     emailMap.get(s.user_id as string) ?? '—',
    updatedAt: s.updated_at as string,
  }))

  return (
    <PageContainer variant="admin" className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">개요</h1>
        <p className="text-sm text-ink-soft mt-1">다시 오신 것을 환영합니다. 현재 상황을 확인하세요.</p>
      </div>

      {/* 통계 카드 4개 — 공용 StatCard. items-start: 보조 수치가 없는 카드는
          옆 카드 높이에 맞춰 늘어나지 않고 내용만큼 작아진다(빈 공간 금지). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-start">
        <StatCard
          icon={<Users size={17} className="text-mark" />}
          value={fmt(totalUsers)}
          label="총 사용자"
          subMetrics={[
            { label: '신규 (월간)', value: fmt(newUsersMonth), growth: growthDisplay(newUsersMonth, prevUsersMonth) },
            { label: '신규 (연간)', value: fmt(newUsersYear), growth: growthDisplay(newUsersYear, prevUsersYear) },
          ]}
        />
        <StatCard
          icon={<DollarSign size={17} className="text-mark" />}
          value={fmtCurrency(totalRevenue)}
          label="총 매출"
          subMetrics={[
            { label: '매출 (월간)', value: fmtCurrency(revMonth), growth: growthDisplay(revMonth, prevRevMonth) },
            { label: '매출 (연간)', value: fmtCurrency(revYear), growth: growthDisplay(revYear, prevRevYear) },
          ]}
        />
        <StatCard
          icon={<Key size={17} className="text-mark" />}
          value={fmt(activeLicenses)}
          label="활성 라이선스"
        />
        <StatCard
          icon={<MessageSquare size={17} className="text-mark" />}
          value={fmt(openTickets)}
          label="열린 티켓"
          iconHref="/admin/support"
          iconTitle="고객지원 티켓 보기"
        />
      </div>

      {/* 두 컬럼 테이블 */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* 최근 주문 (3/5) */}
        <div className="xl:col-span-3 border border-rule bg-paper-raised rounded-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-ink-soft" />
              <h2 className="text-sm font-semibold text-ink">최근 주문</h2>
            </div>
            <a href="/admin/orders" className="text-xs text-mark hover:underline">전체 보기</a>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState message="아직 주문이 없습니다." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="text-left px-6 py-3 text-xs text-ink-faint font-medium">사용자</th>
                    <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">금액</th>
                    <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">상태</th>
                    <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-rule/50 hover:bg-paper-shade transition-colors">
                      <td className="px-6 py-3 text-ink-soft truncate max-w-[160px]">
                        {emailMap.get(order.user_id) || '—'}
                      </td>
                      <td className="px-4 py-3 text-ink font-medium">
                        {fmtCurrency(order.amount ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[order.status] ?? 'text-ink-soft bg-paper-shade'}`}>
                          {orderStatusLabel[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-faint whitespace-nowrap">
                        {fmtDate(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 최근 가입자 (2/5) */}
        <div className="xl:col-span-2 border border-rule bg-paper-raised rounded-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-ink-soft" />
              <h2 className="text-sm font-semibold text-ink">최근 가입자</h2>
            </div>
            <a href="/admin/users" className="text-xs text-mark hover:underline">전체 보기</a>
          </div>
          {(!recentUsers || recentUsers.length === 0) ? (
            <EmptyState message="아직 사용자가 없습니다." />
          ) : (
            <div className="divide-y divide-rule/50">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-6 py-3 hover:bg-paper-shade transition-colors">
                  <InitialAvatar name={u.name} fallbackText={emailMap.get(u.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink font-medium truncate">{u.name || '알 수 없음'}</p>
                    <p className="text-xs text-ink-faint">{fmtDate(u.created_at)}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${statusColors[u.role] ?? 'text-ink-soft bg-paper-shade'}`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Churn Analysis */}
      <ChurnAnalysis entries={cancelEntries} />
    </PageContainer>
  )
}

// 카드 하단 보조 수치 행과 – 표시는 공용 StatCard(components/common/StatCard.tsx)가 그린다.
