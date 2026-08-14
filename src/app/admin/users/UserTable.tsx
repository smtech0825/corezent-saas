'use client'

/**
 * @컴포넌트: UserTable
 * @설명: 관리자 사용자 목록 — 서버사이드 검색·정렬·페이지 나누기(조건은 주소에 담김),
 *        Status 배지, 구매 내역 아코디언, 탈퇴 확인 모달, 역할 변경 드롭다운, CSV 내보내기.
 *        데이터는 현재 페이지 분량만 받는다(전 회원을 통째로 받지 않는다 — page.tsx 참조).
 */

import { useState, Fragment } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Receipt, UserX, Search, X, Loader2, MessageSquare, ExternalLink } from 'lucide-react'
import RoleSelect from './RoleSelect'
import { formatKRW } from '@/lib/money'
import { changeRole, withdrawUser } from './actions'
import type { UserSort } from './query'
import CsvExportButton from './CsvExportButton'
import Pagination from '@/components/common/Pagination'
import SelectField from '@/components/common/SelectField'
import PageContainer from '@/components/common/PageContainer'
import EmptyState from '@/components/common/EmptyState'
import InitialAvatar from '@/components/common/InitialAvatar'

interface Order {
  id: string
  user_id: string
  amount: number
  status: string
  created_at: string
  cancelReason: string | null
}

interface UserData {
  id: string
  name: string
  email: string
  role: string
  created_at: string
  status: string
  hasPayout: boolean
  orders: Order[]
}

interface Props {
  users: UserData[]
  /** 현재 검색 조건의 전체 인원(페이지와 무관) */
  total: number
  page: number
  pageSize: number
  q: string
  sort: UserSort
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(amount: number) {
  // DB의 amount는 cents — formatKRW가 ÷100 후 ₩ 표기 (단일 출처 lib/money)
  return formatKRW(amount)
}

const orderStatusStyle: Record<string, string> = {
  paid:      'text-ok',
  pending:   'text-caution',
  refunded:  'text-info',
  cancelled: 'text-danger',
}

const orderStatusLabel: Record<string, string> = {
  paid:      '결제됨',
  pending:   '대기 중',
  refunded:  '환불됨',
  cancelled: '취소됨',
}

/** 아이콘 버튼 + 툴팁 */
function IconBtn({
  onClick,
  active,
  disabled,
  tooltip,
  danger,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  tooltip: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip}
        className={`p-2 rounded-lg transition-colors ${
          disabled
            ? 'text-ink-faint cursor-not-allowed'
            : active
            ? 'bg-mark/10 text-mark'
            : danger
            ? 'text-ink-faint hover:text-danger hover:bg-danger-soft'
            : 'text-ink-faint hover:text-ink hover:bg-paper-shade'
        }`}
      >
        {children}
      </button>
      {/* 툴팁 */}
      <span className="absolute bottom-full right-0 mb-1.5 px-2 py-1 text-[11px] text-white bg-ink border border-rule rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
        {tooltip}
      </span>
    </div>
  )
}

export default function UserTable({ users, total, page, pageSize, q, sort }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<UserData | null>(null)
  const [withdrawing, setWithdrawing]     = useState(false)

  /**
   * @함수명: buildHref
   * @설명: 검색어·정렬을 유지한 채 페이지만 바꾸는 주소를 만듭니다(페이지네이션·정렬 공용).
   * @매개변수: p - 이동할 페이지 / overrideSort - 정렬 변경 시 지정
   * @반환값: /admin/users?... 주소 문자열
   */
  function buildHref(p: number, overrideSort?: UserSort): string {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const s = overrideSort ?? sort
    if (s !== 'joined') params.set('sort', s)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/admin/users?${qs}` : '/admin/users'
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  // ─── 탈퇴 처리 ───────────────────────────────────────────────
  async function handleWithdraw() {
    if (!withdrawTarget) return
    setWithdrawing(true)
    try {
      const result = await withdrawUser(withdrawTarget.id)
      if (result?.error) {
        // 실패하면 확인 창을 닫지 않는다 — 닫히면 처리된 것으로 오해한다.
        alert(`탈퇴 처리에 실패했습니다.\n${result.error}`)
        return
      }
      setWithdrawTarget(null)
    } catch (err) {
      console.error('[UserTable] 탈퇴 처리 실패:', err)
      alert('탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      // 성공·실패·예외 어느 쪽이든 "처리 중…"에 갇히지 않게 한다.
      setWithdrawing(false)
    }
  }

  return (
    <PageContainer variant="admin" className="space-y-6">

      {/* ── 헤더 + 검색·정렬·내보내기 ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-serif text-ink">사용자 관리</h1>
          <p className="text-sm text-ink-soft mt-1">
            {q ? `검색 결과 ${total}명` : `총 ${total}명`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* 검색바 — 엔터로 검색(서버 조회 — 전체 회원 대상, 조건은 주소에 담김) */}
          <form action="/admin/users" method="GET" className="relative sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="이메일 또는 이름으로 검색..."
              className="w-full bg-paper border border-rule rounded-xl pl-9 pr-8 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark transition-colors"
            />
            {sort !== 'joined' && <input type="hidden" name="sort" value={sort} />}
            {q && (
              <Link
                href={sort !== 'joined' ? `/admin/users?sort=${sort}` : '/admin/users'}
                title="검색어 지우기"
                aria-label="검색어 지우기"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors"
              >
                <X size={12} />
              </Link>
            )}
          </form>

          {/* 정렬 — 가입일·이름 두 가지만 */}
          <SelectField
            size="md"
            aria-label="정렬 기준"
            value={sort}
            onChange={(e) => router.push(buildHref(1, e.target.value === 'name' ? 'name' : 'joined'))}
          >
            <option value="joined">가입일 최신순</option>
            <option value="name">이름순</option>
          </SelectField>

          {/* CSV 내보내기 — 지금 화면의 검색 조건 그대로(확인 창·반출 기록) */}
          <CsvExportButton q={q} sort={sort} total={total} />
        </div>
      </div>

      {/* ── 테이블 ────────────────────────────────────────────── */}
      <div className="border border-rule bg-paper-raised rounded-card overflow-hidden">
        {users.length === 0 ? (
          <EmptyState message={q ? '검색 결과가 없습니다.' : '사용자가 없습니다.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="text-left px-5 py-3 text-xs text-ink-faint font-medium">사용자</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">이메일 / 상태</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">역할</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium hidden lg:table-cell">가입일</th>
                  <th className="text-right px-4 py-3 text-xs text-ink-faint font-medium">작업</th>
                </tr>
              </thead>

              <tbody>
                {users.map((u) => (
                  <Fragment key={u.id}>
                    {/* ── 메인 행 ── */}
                    <tr className="border-b border-rule/50 hover:bg-paper-shade transition-colors">

                      {/* 아바타 + 이름 */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {/* 이름 기반 자동 색(공용 InitialAvatar). 탈퇴 회원은 상태 정보라 위험색 유지 */}
                          <InitialAvatar name={u.name} fallbackText={u.email} inactive={u.status === 'inactive'} />
                          <span className="text-ink font-medium truncate max-w-[100px]">
                            {u.name || '—'}
                          </span>
                        </div>
                      </td>

                      {/* 이메일 + Status 배지 */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-ink-soft text-xs truncate max-w-[160px]">{u.email}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit border ${
                            u.status === 'inactive'
                              ? 'bg-danger-soft text-danger border-danger/20'
                              : 'bg-ok-soft text-ok border-ok/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'inactive' ? 'bg-danger' : 'bg-ok'}`} />
                            {u.status === 'inactive' ? '비활성' : '활성'}
                          </span>
                          {u.hasPayout && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit border bg-mark/10 text-mark border-mark/30">
                              정산계좌 ✓
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 역할 — 배지와 변경 드롭다운이 같은 값을 두 번 보여주던 것을
                          드롭다운 한 칸으로 합침. 재확인·되돌림·실패 처리는 RoleSelect 안에 그대로 */}
                      <td className="px-4 py-3">
                        <RoleSelect userId={u.id} userEmail={u.email} currentRole={u.role} onChange={changeRole} />
                      </td>

                      {/* 가입일 */}
                      <td className="px-4 py-3 text-ink-faint whitespace-nowrap hidden lg:table-cell">
                        {fmtDate(u.created_at)}
                      </td>

                      {/* 액션 버튼 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* 사용자 상세 */}
                          <Link
                            href={`/admin/users/${u.id}`}
                            title="사용자 상세"
                            aria-label={`${u.email} 사용자 상세 보기`}
                            className="p-2 rounded-lg text-ink-faint hover:text-ink hover:bg-paper-shade transition-colors"
                          >
                            <ExternalLink size={14} />
                          </Link>

                          {/* 구매 내역 */}
                          <IconBtn
                            onClick={() => toggleExpand(u.id)}
                            active={expandedId === u.id}
                            tooltip="구매 내역"
                          >
                            <Receipt size={14} />
                          </IconBtn>

                          {/* 탈퇴 처리 — 되돌릴 수 없는 동작이라 아이콘 단독 노출을 피하고
                              테두리형 + 위험색 글자로 안전한 버튼과 구분한다 */}
                          <button
                            onClick={() => setWithdrawTarget(u)}
                            disabled={u.status === 'inactive'}
                            aria-label={u.status === 'inactive' ? `${u.email} 이미 탈퇴함` : `${u.email} 회원 탈퇴`}
                            className="inline-flex items-center gap-1.5 text-xs text-danger border border-danger/20 hover:border-danger/40 hover:bg-danger-soft px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-danger/20 disabled:hover:bg-transparent"
                          >
                            <UserX size={12} />
                            탈퇴
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── 아코디언 — 구매 내역 ── */}
                    {expandedId === u.id && (
                      <tr className="border-b border-rule/50">
                        <td colSpan={5} className="px-5 py-4 bg-paper-shade">
                          <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest mb-3">
                            구매 내역 — {u.name || u.email}
                          </p>
                          {u.orders.length === 0 ? (
                            <p className="text-sm text-ink-faint py-4 text-center">구매 내역이 없습니다.</p>
                          ) : (
                            <div className="max-h-[340px] overflow-y-auto rounded-lg border border-rule">
                              <table className="w-full text-xs">
                                <thead className="sticky top-0 z-10 bg-paper">
                                  <tr className="border-b border-rule">
                                    <th className="text-left px-4 py-2 text-ink-faint font-medium">주문 ID</th>
                                    <th className="text-left px-4 py-2 text-ink-faint font-medium">금액</th>
                                    <th className="text-left px-4 py-2 text-ink-faint font-medium">상태</th>
                                    <th className="text-left px-4 py-2 text-ink-faint font-medium">날짜</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {u.orders.map((o) => (
                                    <Fragment key={o.id}>
                                      <tr className="border-b border-rule/20 last:border-0 hover:bg-paper-shade">
                                        <td className="px-4 py-2.5 font-mono text-ink-faint">
                                          #{o.id.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td className="px-4 py-2.5 text-ink font-medium">
                                          {fmtCurrency(o.amount)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span className={`font-semibold ${orderStatusStyle[o.status] ?? 'text-ink-soft'}`}>
                                            {orderStatusLabel[o.status] ?? o.status}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-ink-faint whitespace-nowrap">
                                          {fmtDate(o.created_at)}
                                        </td>
                                      </tr>
                                      {/* 취소 사유 표시 (cancelled 구독에 연결된 주문) */}
                                      {o.cancelReason && (
                                        <tr className="border-b border-rule/20 last:border-0">
                                          <td colSpan={4} className="px-4 pb-2.5 pt-0">
                                            <div className="flex items-start gap-1.5 pl-1">
                                              <MessageSquare size={11} className="text-ink-faint mt-0.5 shrink-0" />
                                              <span className="text-xs text-ink-soft leading-relaxed">{o.cancelReason}</span>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 페이지네이션 — 공용 부품(검색어·정렬 유지) ─────────── */}
      <Pagination page={page} total={total} pageSize={pageSize} buildHref={(p) => buildHref(p)} />

      {/* ── 탈퇴 확인 모달 ────────────────────────────────────── */}
      {withdrawTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => !withdrawing && setWithdrawTarget(null)}
          />

          {/* 모달 박스 */}
          <div className="relative bg-paper-raised border border-rule rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            {/* 아이콘 + 타이틀 */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-danger-soft border border-danger/20 flex items-center justify-center shrink-0">
                <UserX size={18} className="text-danger" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">회원 탈퇴</h3>
                <p className="text-xs text-ink-faint mt-0.5 break-all">{withdrawTarget.email}</p>
              </div>
            </div>

            <p className="text-sm text-ink-soft leading-relaxed mb-6">
              이 사용자를 탈퇴 처리하시겠습니까?{' '}
              해당 사용자는 더 이상 로그인할 수 없습니다. 데이터는 관리자 패널에 계속 표시됩니다.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setWithdrawTarget(null)}
                disabled={withdrawing}
                className="flex-1 px-4 py-2.5 text-sm text-ink-soft border border-rule rounded-xl hover:bg-paper-shade transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-danger hover:brightness-95 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {withdrawing && <Loader2 size={14} className="animate-spin" />}
                {withdrawing ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
