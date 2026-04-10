'use client'

/**
 * @컴포넌트: LicenseTable
 * @설명: 관리자 라이선스 테이블 — 검색·필터·페이지네이션·Revoke 모달
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, Ban, X } from 'lucide-react'

export interface License {
  id: string
  serialKey: string    // masked (XXXX-****-****-XXXX)
  email: string
  status: string       // 'active' | 'expired' | 'revoked'
  period: string | null  // 'monthly' | 'annual' | null
  renewalDate: string | null
  expiresAt: string | null
  createdAt: string
}

type FilterStatus = 'all' | 'active' | 'canceled' | 'expired'

const PAGE_SIZE = 15

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':  return { label: 'active',   cls: 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20' }
    case 'revoked': return { label: 'canceled',  cls: 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/20' }
    case 'expired': return { label: 'expired',   cls: 'text-red-400 bg-red-400/10 border border-red-400/20' }
    default:        return { label: status,      cls: 'text-[#94A3B8] bg-[#1E293B] border border-[#1E293B]' }
  }
}

function getPeriodBadge(period: string | null) {
  if (!period) return null
  if (period === 'annual')
    return { label: 'Annual',  cls: 'text-violet-400 bg-violet-400/10 border border-violet-400/20' }
  return { label: 'Monthly', cls: 'text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/20' }
}

interface Props {
  licenses: License[]
}

export default function LicenseTable({ licenses }: Props) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [page, setPage] = useState(1)
  const [revokeTarget, setRevokeTarget] = useState<License | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  // 검색 디바운싱 400ms
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [search])

  // 필터 변경 시 첫 페이지로
  useEffect(() => { setPage(1) }, [filterStatus])

  // 필터링
  const filtered = useMemo(() => {
    return licenses.filter((l) => {
      if (debouncedSearch && !l.email.toLowerCase().includes(debouncedSearch.toLowerCase())) return false
      if (filterStatus === 'active'   && l.status !== 'active')  return false
      if (filterStatus === 'canceled' && l.status !== 'revoked') return false
      if (filterStatus === 'expired'  && l.status !== 'expired') return false
      return true
    })
  }, [licenses, debouncedSearch, filterStatus])

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    setRevokeError(null)
    try {
      const res = await fetch('/api/admin/licenses/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: revokeTarget.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRevokeError((data as { error?: string }).error ?? 'Failed to revoke license')
        setRevoking(false)
        return
      }
      // 성공 → 페이지 새로고침
      window.location.reload()
    } catch {
      setRevokeError('Network error. Please try again.')
      setRevoking(false)
    }
  }

  function closeModal() {
    setRevokeTarget(null)
    setRevokeError(null)
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-white">Licenses</h1>
        <p className="text-sm text-[#94A3B8] mt-1">{licenses.length} total licenses</p>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 상태 필터 드롭다운 */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="bg-[#111A2E] border border-[#1E293B] text-[#94A3B8] text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#38BDF8]/50 sm:w-40 shrink-0 cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="canceled">Canceled</option>
          <option value="expired">Expired</option>
        </select>

        {/* 이메일 검색바 */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email..."
            className="w-full bg-[#111A2E] border border-[#1E293B] text-[#F1F5F9] text-sm rounded-xl pl-9 pr-4 py-2.5 placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8]/50"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#475569]">No licenses found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  <th className="text-left px-6 py-3 text-xs text-[#475569] font-medium whitespace-nowrap">Serial Key</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium whitespace-nowrap">User</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium whitespace-nowrap">Period</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium whitespace-nowrap">Renewal Date</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium whitespace-nowrap">Expires</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((l) => {
                  const badge       = getStatusBadge(l.status)
                  const periodBadge = getPeriodBadge(l.period)
                  return (
                    <tr key={l.id} className="border-b border-[#1E293B]/50 hover:bg-[#0B1120]/40 transition-colors">
                      <td className="px-6 py-3">
                        <span className="font-mono text-xs text-[#94A3B8] whitespace-nowrap">{l.serialKey}</span>
                      </td>
                      <td className="px-4 py-3 text-[#94A3B8] text-sm truncate max-w-[200px]">{l.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {periodBadge ? (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${periodBadge.cls}`}>
                            {periodBadge.label}
                          </span>
                        ) : (
                          <span className="text-xs text-[#475569]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#475569] whitespace-nowrap text-xs">{fmtDate(l.renewalDate)}</td>
                      <td className="px-4 py-3 text-[#475569] whitespace-nowrap text-xs">{fmtDate(l.expiresAt)}</td>
                      <td className="px-4 py-3">
                        {l.status === 'active' ? (
                          <button
                            onClick={() => setRevokeTarget(l)}
                            className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Ban size={11} />
                            Revoke
                          </button>
                        ) : (
                          <span className="text-xs text-[#475569]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#1E293B]">
            <span className="text-xs text-[#475569]">
              {filtered.length} results · Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-[#1E293B] text-[#475569] hover:text-white hover:border-[#38BDF8]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-[#1E293B] text-[#475569] hover:text-white hover:border-[#38BDF8]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Revoke 확인 모달 */}
      {revokeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-[#111A2E] border border-[#1E293B] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            {/* 모달 헤더 */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-400/10 border border-red-400/20 shrink-0">
                  <Ban size={18} className="text-red-400" />
                </div>
                <h3 className="text-white font-semibold">Revoke License</h3>
              </div>
              <button
                onClick={closeModal}
                className="text-[#475569] hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* 경고 문구 */}
            <p className="text-sm text-[#94A3B8] mb-3 leading-relaxed">
              Are you sure you want to revoke this license?{' '}
              <span className="text-white font-medium">The user will immediately lose access.</span>
            </p>
            <p className="font-mono text-xs text-[#475569] bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 mb-5">
              {revokeTarget.serialKey}
            </p>

            {/* 에러 */}
            {revokeError && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4">
                {revokeError}
              </p>
            )}

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={closeModal}
                disabled={revoking}
                className="flex-1 py-2.5 rounded-xl border border-[#1E293B] text-sm text-[#94A3B8] hover:text-white hover:border-[#38BDF8]/30 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-400/30 text-sm text-red-400 hover:bg-red-500/20 hover:border-red-400/50 font-semibold transition-colors disabled:opacity-50"
              >
                {revoking ? 'Revoking...' : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
