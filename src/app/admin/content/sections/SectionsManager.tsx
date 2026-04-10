'use client'

/**
 * @컴포넌트: SectionsManager
 * @설명: 랜딩 페이지 섹션 가시성 및 순서 관리
 *        - 드래그 앤 드롭으로 order_index 변경 → /api/admin/sections/reorder 호출
 *        - 토글로 is_visible 변경 → /api/admin/sections/toggle 호출
 *        - 낙관적 UI: 즉시 반영 후 실패 시 롤백
 *        - API 성공 시 revalidatePath('/') → 랜딩 페이지 캐시 즉시 무효화
 */

import { useState, useTransition } from 'react'
import { GripVertical, Eye, EyeOff } from 'lucide-react'

interface Section {
  name: string
  label: string
  is_visible: boolean
  order_index: number
}

export default function SectionsManager({ sections }: { sections: Section[] }) {
  const [items, setItems] = useState(() =>
    [...sections].sort((a, b) => a.order_index - b.order_index)
  )
  const [isPending, startTransition] = useTransition()
  const [dragging, setDragging]     = useState<number | null>(null)
  const [dragOver, setDragOver]     = useState<number | null>(null)
  const [saveError, setSaveError]   = useState<string | null>(null)

  // ── 가시성 토글 ─────────────────────────────────────────────────────────────
  function handleToggle(name: string, current: boolean) {
    const next = !current
    // 낙관적 업데이트
    setItems((prev) => prev.map((s) => (s.name === name ? { ...s, is_visible: next } : s)))
    setSaveError(null)

    startTransition(async () => {
      const res = await fetch('/api/admin/sections/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, is_visible: next }),
      })
      if (!res.ok) {
        // 실패 시 원래 값으로 롤백
        setItems((prev) => prev.map((s) => (s.name === name ? { ...s, is_visible: current } : s)))
        setSaveError('Visibility update failed. Please try again.')
      }
    })
  }

  // ── 드래그 앤 드롭 ──────────────────────────────────────────────────────────
  function handleDragStart(idx: number) {
    setDragging(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setDragOver(idx)
  }

  function handleDrop(toIdx: number) {
    if (dragging === null || dragging === toIdx) {
      setDragging(null)
      setDragOver(null)
      return
    }

    const prev = [...items]
    const reordered = [...items]
    const [moved] = reordered.splice(dragging, 1)
    reordered.splice(toIdx, 0, moved)
    setItems(reordered)
    setDragging(null)
    setDragOver(null)
    setSaveError(null)

    startTransition(async () => {
      const res = await fetch('/api/admin/sections/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered: reordered.map((s) => s.name) }),
      })
      if (!res.ok) {
        // 실패 시 원래 순서로 롤백
        setItems(prev)
        setSaveError('Reorder failed. Please try again.')
      }
    })
  }

  return (
    <div className="space-y-2">
      {/* 상태 메시지 */}
      {isPending && <p className="text-xs text-amber-400 px-1">Saving…</p>}
      {saveError && !isPending && (
        <p className="text-xs text-red-400 px-1">{saveError}</p>
      )}

      {items.map((section, idx) => (
        <div
          key={section.name}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={() => { setDragging(null); setDragOver(null) }}
          className={[
            'flex items-center gap-4 px-5 py-4 border rounded-xl cursor-grab active:cursor-grabbing transition-all',
            dragOver === idx
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-[#1E293B] bg-[#111A2E] hover:border-[#1E293B]/80',
            dragging === idx ? 'opacity-40' : 'opacity-100',
          ].join(' ')}
        >
          <GripVertical size={16} className="text-[#475569] hover:text-[#94A3B8] shrink-0" />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{section.label}</p>
            <p className="text-xs text-[#475569] font-mono">{section.name}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${section.is_visible ? 'text-emerald-400' : 'text-[#475569]'}`}>
              {section.is_visible ? 'Visible' : 'Hidden'}
            </span>
            <button
              onClick={() => handleToggle(section.name, section.is_visible)}
              disabled={isPending}
              className={`w-10 h-6 rounded-full transition-colors relative overflow-hidden disabled:opacity-60 ${
                section.is_visible ? 'bg-emerald-500' : 'bg-[#1E293B]'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  section.is_visible ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
            {section.is_visible ? (
              <Eye size={14} className="text-emerald-400" />
            ) : (
              <EyeOff size={14} className="text-[#475569]" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
