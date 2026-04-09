/**
 * @컴포넌트: Pagination
 * @설명: 공통 페이지네이션 — [처음] [이전] [현재] [다음] [끝] 버튼 UI
 *        서버 컴포넌트 — buildHref 함수를 서버에서 받기 위해 'use client' 제거
 */

import Link from 'next/link'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

interface Props {
  page: number
  total: number
  pageSize: number
  buildHref: (p: number) => string
}

export default function Pagination({ page, total, pageSize, buildHref }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  const hasPrev = page > 1
  const hasNext = page < totalPages

  const base = 'inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm border transition-colors'
  const on   = 'text-[#94A3B8] border-[#1E293B] hover:text-white hover:border-[#38BDF8]/30'
  const cur  = 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/40 font-semibold'
  const off  = 'text-[#475569] border-[#1E293B] opacity-40 pointer-events-none'

  return (
    <div className="flex items-center justify-center gap-1.5 mt-5 select-none">
      <Link href={buildHref(1)}        className={`${base} ${hasPrev ? on : off}`}><ChevronsLeft  size={14} /></Link>
      <Link href={buildHref(page - 1)} className={`${base} ${hasPrev ? on : off}`}><ChevronLeft   size={14} /></Link>

      <span className={`${base} ${cur}`}>{page}</span>
      {totalPages > 1 && (
        <span className="text-xs text-[#475569] px-1">/ {totalPages}</span>
      )}

      <Link href={buildHref(page + 1)}     className={`${base} ${hasNext ? on : off}`}><ChevronRight  size={14} /></Link>
      <Link href={buildHref(totalPages)}   className={`${base} ${hasNext ? on : off}`}><ChevronsRight size={14} /></Link>
    </div>
  )
}
