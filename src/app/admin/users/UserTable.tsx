'use client'

/**
 * @컴포넌트: UserTable
 * @설명: 관리자 사용자 목록 — 이메일 검색, Status 배지, 구매 내역 아코디언,
 *        탈퇴 확인 모달, 역할 변경 드롭다운, 20명/페이지 페이지네이션
 */

import { useState, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { Shield, User, Receipt, UserX, Search, X, Loader2, ChevronLeft, ChevronRight, MessageSquare, ExternalLink } from 'lucide-react'
import RoleSelect from './RoleSelect'
import { formatKRW } from '@/lib/money'
import { changeRole, withdrawUser } from './actions'

const PAGE_SIZE = 20

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
  country: string
  created_at: string
  status: string
  hasPayout: boolean
  orders: Order[]
}

interface Props {
  users: UserData[]
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

export default function UserTable({ users }: Props) {
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(1)
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<UserData | null>(null)
  const [withdrawing, setWithdrawing]     = useState(false)

  // ─── 검색 필터 (이메일 + 이름) ──────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q),
    )
  }, [users, search])

  // ─── 페이지네이션 ────────────────────────────────────────────
  const total      = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSearch(val: string) {
    setSearch(val)
    setPage(1)
    setExpandedId(null)
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  // ─── 탈퇴 처리 ───────────────────────────────────────────────
  async function handleWithdraw() {
    if (!withdrawTarget) return
    setWithdrawing(true)
    await withdrawUser(withdrawTarget.id)
    setWithdrawing(false)
    setWithdrawTarget(null)
  }

  // ─── 페이지 번호 목록 (최대 5개) ─────────────────────────────
  const pageNums = useMemo<number[]>(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 3)             return [1, 2, 3, 4, 5]
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [page - 2, page - 1, page, page + 1, page + 2]
  }, [page, totalPages])

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── 헤더 + 검색바 ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-serif text-ink">사용자 관리</h1>
          <p className="text-sm text-ink-soft mt-1">
            {search.trim()
              ? `전체 ${users.length}명 중 ${filtered.length}명`
              : `총 ${users.length}명`}
          </p>
        </div>

        {/* 검색바 */}
        <div className="relative sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="이메일 또는 이름으로 검색..."
            className="w-full bg-paper border border-rule rounded-xl pl-9 pr-8 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark transition-colors"
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── 테이블 ────────────────────────────────────────────── */}
      <div className="border border-rule bg-paper-raised rounded-2xl overflow-hidden">
        {paginated.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-faint">
            {search ? '검색 결과가 없습니다.' : '사용자가 없습니다.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="text-left px-5 py-3 text-xs text-ink-faint font-medium">사용자</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">이메일 / 상태</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">역할</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium hidden md:table-cell">국가</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium hidden lg:table-cell">가입일</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">역할 변경</th>
                  <th className="text-right px-4 py-3 text-xs text-ink-faint font-medium">작업</th>
                </tr>
              </thead>

              <tbody>
                {paginated.map((u) => (
                  <Fragment key={u.id}>
                    {/* ── 메인 행 ── */}
                    <tr className="border-b border-rule/50 hover:bg-paper-shade transition-colors">

                      {/* 아바타 + 이름 */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                            u.status === 'inactive'
                              ? 'bg-danger-soft border-danger/20 text-danger'
                              : 'bg-mark/10 border-mark/30 text-mark'
                          }`}>
                            {((u.name || u.email)[0] ?? '?').toUpperCase()}
                          </span>
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

                      {/* 역할 배지 */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full capitalize ${
                          u.role === 'admin'
                            ? 'bg-mark/10 text-mark'
                            : 'bg-paper-shade text-ink-soft'
                        }`}>
                          {u.role === 'admin' ? <Shield size={11} /> : <User size={11} />}
                          {u.role === 'admin' ? '관리자' : '사용자'}
                        </span>
                      </td>

                      {/* 국가 */}
                      <td className="px-4 py-3 text-ink-faint hidden md:table-cell">
                        {u.country || '—'}
                      </td>

                      {/* 가입일 */}
                      <td className="px-4 py-3 text-ink-faint whitespace-nowrap hidden lg:table-cell">
                        {fmtDate(u.created_at)}
                      </td>

                      {/* 역할 변경 드롭다운 */}
                      <td className="px-4 py-3">
                        <RoleSelect userId={u.id} currentRole={u.role} onChange={changeRole} />
                      </td>

                      {/* 액션 버튼 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* 사용자 상세 */}
                          <Link
                            href={`/admin/users/${u.id}`}
                            title="사용자 상세"
                            className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-paper-shade transition-colors"
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

                          {/* 탈퇴 처리 */}
                          <IconBtn
                            onClick={() => setWithdrawTarget(u)}
                            disabled={u.status === 'inactive'}
                            tooltip={u.status === 'inactive' ? '이미 탈퇴함' : '회원 탈퇴'}
                            danger
                          >
                            <UserX size={14} />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>

                    {/* ── 아코디언 — 구매 내역 ── */}
                    {expandedId === u.id && (
                      <tr className="border-b border-rule/50">
                        <td colSpan={7} className="px-5 py-4 bg-paper-shade">
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

      {/* ── 페이지네이션 ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-ink-faint shrink-0">
            {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 flex items-center justify-center text-ink-soft border border-rule rounded-lg disabled:opacity-30 hover:bg-paper-shade transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {pageNums.map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-9 h-9 text-xs font-medium rounded-lg transition-colors ${
                  n === page
                    ? 'bg-mark text-white font-semibold'
                    : 'text-ink-soft border border-rule hover:bg-paper-shade'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-9 h-9 flex items-center justify-center text-ink-soft border border-rule rounded-lg disabled:opacity-30 hover:bg-paper-shade transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

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
    </div>
  )
}
