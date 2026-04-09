'use client'

/**
 * @컴포넌트: UserTable
 * @설명: 관리자 사용자 목록 — 이메일 검색, Status 배지, 구매 내역 아코디언,
 *        탈퇴 확인 모달, 역할 변경 드롭다운, 20명/페이지 페이지네이션
 */

import { useState, useMemo, Fragment } from 'react'
import { Shield, User, Receipt, UserX, Search, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import RoleSelect from './RoleSelect'
import { changeRole, withdrawUser } from './actions'

const PAGE_SIZE = 20

interface Order {
  id: string
  user_id: string
  amount: number
  status: string
  created_at: string
}

interface UserData {
  id: string
  name: string
  email: string
  role: string
  country: string
  created_at: string
  status: string
  orders: Order[]
}

interface Props {
  users: UserData[]
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(amount: number) {
  // DB의 amount는 센트 단위 (orders 페이지와 동일한 방식)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)
}

const orderStatusStyle: Record<string, string> = {
  paid:      'text-emerald-400',
  pending:   'text-amber-400',
  refunded:  'text-blue-400',
  cancelled: 'text-red-400',
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
            ? 'text-[#1E293B] cursor-not-allowed'
            : active
            ? 'bg-[#38BDF8]/15 text-[#38BDF8]'
            : danger
            ? 'text-[#475569] hover:text-red-400 hover:bg-red-500/10'
            : 'text-[#475569] hover:text-[#94A3B8] hover:bg-[#1E293B]'
        }`}
      >
        {children}
      </button>
      {/* 툴팁 */}
      <span className="absolute bottom-full right-0 mb-1.5 px-2 py-1 text-[11px] text-white bg-[#0B1120] border border-[#1E293B] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
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
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            {search.trim()
              ? `${filtered.length} of ${users.length} users`
              : `${users.length} total users`}
          </p>
        </div>

        {/* 검색바 */}
        <div className="relative sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full bg-[#111A2E] border border-[#1E293B] rounded-xl pl-9 pr-8 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8]/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── 테이블 ────────────────────────────────────────────── */}
      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        {paginated.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#475569]">
            {search ? 'No users match your search.' : 'No users found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  <th className="text-left px-5 py-3 text-xs text-[#475569] font-medium">User</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Email / Status</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium hidden md:table-cell">Country</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium hidden lg:table-cell">Joined</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Change Role</th>
                  <th className="text-right px-4 py-3 text-xs text-[#475569] font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginated.map((u) => (
                  <Fragment key={u.id}>
                    {/* ── 메인 행 ── */}
                    <tr className="border-b border-[#1E293B]/50 hover:bg-[#0B1120]/40 transition-colors">

                      {/* 아바타 + 이름 */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                            u.status === 'inactive'
                              ? 'bg-red-500/10 border-red-500/20 text-red-400'
                              : 'bg-[#38BDF8]/10 border-[#38BDF8]/20 text-[#38BDF8]'
                          }`}>
                            {((u.name || u.email)[0] ?? '?').toUpperCase()}
                          </span>
                          <span className="text-white font-medium truncate max-w-[100px]">
                            {u.name || '—'}
                          </span>
                        </div>
                      </td>

                      {/* 이메일 + Status 배지 */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[#94A3B8] text-xs truncate max-w-[160px]">{u.email}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit border ${
                            u.status === 'inactive'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'inactive' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                            {u.status}
                          </span>
                        </div>
                      </td>

                      {/* 역할 배지 */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full capitalize ${
                          u.role === 'admin'
                            ? 'bg-amber-400/10 text-amber-400'
                            : 'bg-[#1E293B] text-[#94A3B8]'
                        }`}>
                          {u.role === 'admin' ? <Shield size={11} /> : <User size={11} />}
                          {u.role}
                        </span>
                      </td>

                      {/* 국가 */}
                      <td className="px-4 py-3 text-[#475569] hidden md:table-cell">
                        {u.country || '—'}
                      </td>

                      {/* 가입일 */}
                      <td className="px-4 py-3 text-[#475569] whitespace-nowrap hidden lg:table-cell">
                        {fmtDate(u.created_at)}
                      </td>

                      {/* 역할 변경 드롭다운 */}
                      <td className="px-4 py-3">
                        <RoleSelect userId={u.id} currentRole={u.role} onChange={changeRole} />
                      </td>

                      {/* 액션 버튼 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* 구매 내역 */}
                          <IconBtn
                            onClick={() => toggleExpand(u.id)}
                            active={expandedId === u.id}
                            tooltip="Purchase History"
                          >
                            <Receipt size={14} />
                          </IconBtn>

                          {/* 탈퇴 처리 */}
                          <IconBtn
                            onClick={() => setWithdrawTarget(u)}
                            disabled={u.status === 'inactive'}
                            tooltip={u.status === 'inactive' ? 'Already withdrawn' : 'Withdraw User'}
                            danger
                          >
                            <UserX size={14} />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>

                    {/* ── 아코디언 — 구매 내역 ── */}
                    {expandedId === u.id && (
                      <tr className="border-b border-[#1E293B]/50">
                        <td colSpan={7} className="px-5 py-4 bg-slate-900/50">
                          <p className="text-xs font-semibold text-[#475569] uppercase tracking-widest mb-3">
                            Purchase History — {u.name || u.email}
                          </p>
                          {u.orders.length === 0 ? (
                            <p className="text-sm text-[#475569] py-4 text-center">No purchase history found.</p>
                          ) : (
                            <div className="max-h-[340px] overflow-y-auto rounded-lg border border-[#1E293B]/60">
                              <table className="w-full text-xs">
                                <thead className="sticky top-0 z-10 bg-[#0B1120]">
                                  <tr className="border-b border-[#1E293B]/40">
                                    <th className="text-left px-4 py-2 text-[#475569] font-medium">Order ID</th>
                                    <th className="text-left px-4 py-2 text-[#475569] font-medium">Amount</th>
                                    <th className="text-left px-4 py-2 text-[#475569] font-medium">Status</th>
                                    <th className="text-left px-4 py-2 text-[#475569] font-medium">Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {u.orders.map((o) => (
                                    <tr key={o.id} className="border-b border-[#1E293B]/20 last:border-0 hover:bg-[#111A2E]/60">
                                      <td className="px-4 py-2.5 font-mono text-[#475569]">
                                        #{o.id.slice(0, 8).toUpperCase()}
                                      </td>
                                      <td className="px-4 py-2.5 text-white font-medium">
                                        {fmtCurrency(o.amount)}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className={`capitalize font-semibold ${orderStatusStyle[o.status] ?? 'text-[#94A3B8]'}`}>
                                          {o.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-[#475569] whitespace-nowrap">
                                        {fmtDate(o.created_at)}
                                      </td>
                                    </tr>
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
          <span className="text-xs text-[#475569] shrink-0">
            {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 flex items-center justify-center text-[#94A3B8] border border-[#1E293B] rounded-lg disabled:opacity-30 hover:bg-[#1E293B] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {pageNums.map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-9 h-9 text-xs font-medium rounded-lg transition-colors ${
                  n === page
                    ? 'bg-[#38BDF8] text-[#0B1120] font-semibold'
                    : 'text-[#94A3B8] border border-[#1E293B] hover:bg-[#1E293B]'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-9 h-9 flex items-center justify-center text-[#94A3B8] border border-[#1E293B] rounded-lg disabled:opacity-30 hover:bg-[#1E293B] transition-colors"
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !withdrawing && setWithdrawTarget(null)}
          />

          {/* 모달 박스 */}
          <div className="relative bg-[#111A2E] border border-[#1E293B] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            {/* 아이콘 + 타이틀 */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <UserX size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Withdraw User</h3>
                <p className="text-xs text-[#475569] mt-0.5 break-all">{withdrawTarget.email}</p>
              </div>
            </div>

            <p className="text-sm text-[#94A3B8] leading-relaxed mb-6">
              Are you sure you want to withdraw this user?{' '}
              They will no longer be able to log in. Their data remains visible in the admin panel.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setWithdrawTarget(null)}
                disabled={withdrawing}
                className="flex-1 px-4 py-2.5 text-sm text-[#94A3B8] border border-[#1E293B] rounded-xl hover:bg-[#1E293B] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {withdrawing && <Loader2 size={14} className="animate-spin" />}
                {withdrawing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
