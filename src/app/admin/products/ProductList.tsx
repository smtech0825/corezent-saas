'use client'

/**
 * @컴포넌트: ProductList
 * @설명: 관리자 제품 목록 — 위/아래 화살표로 순서 변경 + API 호출
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Pencil, ChevronUp, ChevronDown } from 'lucide-react'
import DeleteButton from './DeleteButton'

export interface ProductRow {
  id: string
  name: string
  slug: string
  category: string
  tagline: string
  is_active: boolean
  monthlyLabel: string
  annualLabel: string
}

interface Props {
  products: ProductRow[]
  onDelete: (id: string) => Promise<void>
}

const categoryColors: Record<string, string> = {
  desktop: 'text-violet-400 bg-violet-400/10',
  web: 'text-[#38BDF8] bg-[#38BDF8]/10',
  'chrome-extension': 'text-amber-400 bg-amber-400/10',
  mobile: 'text-emerald-400 bg-emerald-400/10',
}

export default function ProductList({ products: initial, onDelete }: Props) {
  const [items, setItems] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  function swap(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= items.length) return

    const next = [...items]
    const temp = next[fromIdx]
    next[fromIdx] = next[toIdx]
    next[toIdx] = temp
    setItems(next)
    setSaveMsg(null)

    startTransition(async () => {
      const res = await fetch('/api/admin/products/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered: next.map((p) => p.id) }),
      })
      if (res.ok) {
        setSaveMsg('Order saved')
        setTimeout(() => setSaveMsg(null), 2000)
      } else {
        // 롤백
        setItems(initial)
        setSaveMsg('Reorder failed')
      }
    })
  }

  return (
    <div className="space-y-2">
      {/* 상태 메시지 */}
      {isPending && <p className="text-xs text-amber-400 px-1">Saving…</p>}
      {saveMsg && !isPending && (
        <p className={`text-xs px-1 ${saveMsg.includes('fail') ? 'text-red-400' : 'text-emerald-400'}`}>
          {saveMsg}
        </p>
      )}

      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E293B]">
                <th className="text-left px-3 py-3 text-xs text-[#475569] font-medium w-16">Order</th>
                <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Product</th>
                <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Category</th>
                <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Monthly</th>
                <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Annual</th>
                <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p, idx) => (
                <tr key={p.id} className="border-b border-[#1E293B]/50 hover:bg-[#0B1120]/40 transition-colors">
                  {/* 순서 변경 화살표 */}
                  <td className="px-3 py-4">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => swap(idx, idx - 1)}
                        disabled={idx === 0 || isPending}
                        className="p-0.5 text-[#475569] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <span className="text-[10px] text-[#475569] tabular-nums font-mono">{idx + 1}</span>
                      <button
                        onClick={() => swap(idx, idx + 1)}
                        disabled={idx === items.length - 1 || isPending}
                        className="p-0.5 text-[#475569] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <p className="font-semibold text-white">{p.name}</p>
                    <p className="text-xs text-[#475569] mt-0.5">{p.tagline}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${categoryColors[p.category] ?? 'text-[#94A3B8] bg-[#1E293B]'}`}>
                      {p.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[#94A3B8]">{p.monthlyLabel}</td>
                  <td className="px-4 py-4 text-[#94A3B8]">{p.annualLabel}</td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      p.is_active ? 'text-emerald-400 bg-emerald-400/10' : 'text-[#475569] bg-[#1E293B]'
                    }`}>
                      {p.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        className="p-1.5 text-[#475569] hover:text-amber-400 transition-colors rounded"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </Link>
                      <DeleteButton
                        productId={p.id}
                        productName={p.name}
                        onDelete={onDelete}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
