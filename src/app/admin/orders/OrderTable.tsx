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
import { useRouter } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { formatKRW } from '@/lib/money'

const PAGE_SIZE = 15

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })
}

export interface Order {
  id: string
  shortId: string
  email: string
  amount: number
  currency: string
  status: string
  created_at: string
  expires_at: string | null
  period: string | null
}

interface Props {
  orders: Order[]
  totalRevenue: number
}

function getStatusBadge(status: string, expiresAt: string | null): { label: string; cls: string } {
  // 1순위: refunded는 항상 refunded 표시
  if (status === 'refunded') {
    return { label: '환불됨', cls: 'text-blue-400 bg-blue-400/10' }
  }
  // 2순위: 만료일이 지났거나 cancelled → expired
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false
  if (status === 'cancelled' || isExpired) {
    return { label: '만료됨', cls: 'text-red-400 bg-red-400/10' }
  }
  // 3순위: paid → active
  if (status === 'paid') {
    return { label: '활성', cls: 'text-emerald-400 bg-emerald-400/10' }
  }
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: '대기 중', cls: 'text-amber-400 bg-amber-400/10' },
  }
  return map[status] ?? { label: status, cls: 'text-[#94A3B8] bg-[#1E293B]' }
}

export default function OrderTable({ orders, totalRevenue }: Props) {
  const router = useRouter()
  const [rawSearch, setRawSearch] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // 필터: 상태 · 기간(날짜 범위)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // 검색 디바운싱 400ms
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(rawSearch)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [rawSearch])

  // 필터 변경 시 첫 페이지로
  useEffect(() => { setPage(1) }, [statusFilter, dateFrom, dateTo])

  // 검색 + 상태 + 기간 필터링
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59.999').getTime() : null
    return orders.filter((o) => {
      if (q && !(o.shortId.toLowerCase().includes(q) || o.email.toLowerCase().includes(q))) return false
      if (statusFilter && o.status !== statusFilter) return false
      const ts = new Date(o.created_at).getTime()
      if (fromTs !== null && ts < fromTs) return false
      if (toTs !== null && ts > toTs) return false
      return true
    })
  }, [orders, search, statusFilter, dateFrom, dateTo])

  // 현재 필터 결과를 CSV로 내보내기 (표시금액 + 원시 cents·통화 병행 — 회계용)
  function handleExport() {
    const header = ['주문ID', '이메일', '금액(표시)', '금액(cents)', '통화', '상태', '주기', '주문일', '만료일']
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = filtered.map((o) =>
      [o.shortId, o.email, formatKRW(o.amount), o.amount, o.currency, o.status, o.period ?? '',
       new Date(o.created_at).toISOString(), o.expires_at ? new Date(o.expires_at).toISOString() : '']
        .map(esc).join(','),
    )
    // 앞에 BOM(﻿)을 붙여 Excel에서 한글이 깨지지 않게 한다.
    const csv = '﻿' + [header.join(','), ...lines].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
          <h1 className="text-2xl font-bold text-white">주문</h1>
          <p className="text-sm text-[#94A3B8] mt-1">총 {orders.length}건의 주문</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2 tabular-nums">
            {formatKRW(totalRevenue)}
          </p>
          <p className="text-xs text-[#475569] mt-0.5">총 매출 (결제 완료)</p>
        </div>

        {/* 검색 바 — 테이블 우측 상단 */}
        <div className="sm:self-end">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />
            <input
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="주문 ID 또는 이메일로 검색…"
              className="w-64 bg-[#111A2E] border border-[#1E293B] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* 필터 · 내보내기 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#111A2E] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38BDF8] cursor-pointer"
        >
          <option value="">전체 상태</option>
          <option value="paid">결제됨</option>
          <option value="pending">대기 중</option>
          <option value="refunded">환불됨</option>
          <option value="cancelled">취소됨</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="시작일"
          className="bg-[#111A2E] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38BDF8]"
        />
        <span className="text-[#475569] text-sm">~</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="종료일"
          className="bg-[#111A2E] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38BDF8]"
        />
        <button
          type="button"
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#38BDF8] border border-[#38BDF8]/30 hover:border-[#38BDF8]/60 hover:bg-[#38BDF8]/5 px-3 py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Download size={14} /> CSV 내보내기
        </button>
        <span className="text-xs text-[#475569] ml-auto">{filtered.length}건</span>
      </div>

      {/* 테이블 카드 */}
      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#475569]">
            {(search || statusFilter || dateFrom || dateTo) ? '조건에 맞는 주문이 없습니다.' : '주문이 없습니다.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E293B]">
                    <th className="text-left px-6 py-3 text-xs text-[#475569] font-medium">주문 ID</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">고객</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">금액</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">상태</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">결제 주기</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">날짜</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">만료일</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((o) => {
                    const badge = getStatusBadge(o.status, o.expires_at)
                    return (
                      <tr
                        key={o.id}
                        onClick={() => router.push(`/admin/orders/${o.id}`)}
                        className="border-b border-[#1E293B]/50 hover:bg-[#0B1120]/40 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-3">
                          <span className="font-mono text-xs text-[#94A3B8]">#{o.shortId}</span>
                        </td>
                        <td className="px-4 py-3 text-[#94A3B8] truncate max-w-[200px]">{o.email}</td>
                        <td className="px-4 py-3 text-white font-medium tabular-nums">
                          {formatKRW(o.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {o.period ? (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                              o.period === 'annual'
                                ? 'text-violet-400 bg-violet-400/10 border border-violet-400/20'
                                : 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/20'
                            }`}>
                              {o.period === 'annual' ? '연간' : '월간'}
                            </span>
                          ) : (
                            <span className="text-[#475569]">—</span>
                          )}
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
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length}
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
