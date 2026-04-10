'use client'

/**
 * @컴포넌트: OrderTable
 * @설명: 관리자 주문 목록 클라이언트 컴포넌트
 *        - 검색 (Order ID / 이메일) — 디바운싱 400ms
 *        - 페이지네이션 (15개/페이지)
 *        - Expire Date 컬럼 (amber 배지)
 *        - 취소/만료 주문 → red 'expired' 배지
 */

import { useState, useMemo, useEffect } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 15

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export interface Order {
  id: string
  shortId: string
  email: string
  amount: number
  status: string
  created_at: string
  expires_at: string | null
}

interface Props {
  orders: Order[]
  totalRevenue: number
}

function getStatusBadge(status: string, expiresAt: string | null): { label: string; cls: string } {
  // 구독 취소 상태이거나 만료일이 현재보다 이전이면 'expired' 표시
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false
  if (status === 'cancelled' || isExpired) {
    return { label: 'expired', cls: 'text-red-400 bg-red-400/10' }
  }
  const map: Record<string, { label: string; cls: string }> = {
    paid:     { label: 'paid',     cls: 'text-emerald-400 bg-emerald-400/10' },
    pending:  { label: 'pending',  cls: 'text-amber-400 bg-amber-400/10' },
    refunded: { label: 'refunded', cls: 'text-blue-400 bg-blue-400/10' },
  }
  return map[status] ?? { label: status, cls: 'text-[#94A3B8] bg-[#1E293B]' }
}

export default function OrderTable({ orders, totalRevenue }: Props) {
  const [rawSearch, setRawSearch] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // 검색 디바운싱 400ms
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(rawSearch)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [rawSearch])

  // 검색 필터링
  const filtered = useMemo(() => {
    if (!search.trim()) return orders
    const q = search.toLowerCase()
    return orders.filter(
      (o) => o.shortId.toLowerCase().includes(q) || o.email.toLowerCase().includes(q),
    )
  }, [orders, search])

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const pageStart = Math.max(1, safePage - 2)
  const pageEnd = Math.min(totalPages, pageStart + 4)
  const pageNums: number[] = []
  for (let i = pageStart; i <= pageEnd; i++) pageNums.push(i)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 헤더 — Total Revenue를 왼쪽 하단으로 이동 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{orders.length} total orders</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2 tabular-nums">
            {fmtCurrency(totalRevenue)}
          </p>
          <p className="text-xs text-[#475569] mt-0.5">Total Revenue (paid)</p>
        </div>

        {/* 검색 바 — 테이블 우측 상단 */}
        <div className="sm:self-end">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />
            <input
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="Search by Order ID or email…"
              className="w-64 bg-[#111A2E] border border-[#1E293B] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* 테이블 카드 */}
      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#475569]">
            {search ? 'No orders match your search.' : 'No orders yet.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E293B]">
                    <th className="text-left px-6 py-3 text-xs text-[#475569] font-medium">Order ID</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Customer</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Amount</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Expire Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((o) => {
                    const badge = getStatusBadge(o.status, o.expires_at)
                    return (
                      <tr key={o.id} className="border-b border-[#1E293B]/50 hover:bg-[#0B1120]/40 transition-colors">
                        <td className="px-6 py-3">
                          <span className="font-mono text-xs text-[#94A3B8]">#{o.shortId}</span>
                        </td>
                        <td className="px-4 py-3 text-[#94A3B8] truncate max-w-[200px]">{o.email}</td>
                        <td className="px-4 py-3 text-white font-medium tabular-nums">
                          {fmtCurrency(o.amount / 100)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#475569] whitespace-nowrap">{fmtDate(o.created_at)}</td>
                        <td className="px-4 py-3">
                          {o.expires_at ? (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap text-amber-400 bg-amber-400/10 border border-amber-400/20">
                              {fmtDate(o.expires_at)}
                            </span>
                          ) : (
                            <span className="text-[#475569]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-[#1E293B]">
                <p className="text-xs text-[#475569]">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="p-1.5 rounded text-[#475569] hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {pageNums.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                        n === safePage
                          ? 'bg-[#38BDF8] text-[#0B1120]'
                          : 'text-[#475569] hover:text-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded text-[#475569] hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
