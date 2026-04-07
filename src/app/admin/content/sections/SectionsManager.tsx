'use client'

/**
 * @컴포넌트: SectionsManager
 * @설명: 랜딩 페이지 섹션 가시성 및 순서 관리 (클라이언트 인터랙션)
 */

import { useState, useTransition } from 'react'
import { GripVertical, Eye, EyeOff } from 'lucide-react'

interface Section {
  name: string
  label: string
  is_visible: boolean
  order_index: number
}

interface Props {
  sections: Section[]
  onToggle: (name: string, visible: boolean) => Promise<void>
  onReorder: (ordered: string[]) => Promise<void>
}

export default function SectionsManager({ sections, onToggle, onReorder }: Props) {
  const [items, setItems] = useState(() => [...sections].sort((a, b) => a.order_index - b.order_index))
  const [isPending, startTransition] = useTransition()
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  function handleToggle(name: string, current: boolean) {
    setItems((prev) =>
      prev.map((s) => (s.name === name ? { ...s, is_visible: !current } : s))
    )
    startTransition(() => onToggle(name, !current))
  }

  function handleDragStart(idx: number) {
    setDragging(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setDragOver(idx)
  }

  function handleDrop(idx: number) {
    if (dragging === null || dragging === idx) {
      setDragging(null)
      setDragOver(null)
      return
    }
    const reordered = [...items]
    const [moved] = reordered.splice(dragging, 1)
    reordered.splice(idx, 0, moved)
    setItems(reordered)
    setDragging(null)
    setDragOver(null)
    startTransition(() => onReorder(reordered.map((s) => s.name)))
  }

  return (
    <div className="space-y-2">
      {isPending && (
        <p className="text-xs text-amber-400 px-1">Saving…</p>
      )}
      {items.map((section, idx) => (
        <div
          key={section.name}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={() => { setDragging(null); setDragOver(null) }}
          className={`flex items-center gap-4 px-5 py-4 border rounded-xl cursor-grab active:cursor-grabbing transition-all ${
            dragOver === idx
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-[#1E293B] bg-[#111A2E] hover:border-[#1E293B]/80'
          } ${dragging === idx ? 'opacity-40' : 'opacity-100'}`}
        >
          <GripVertical size={16} className="text-[#1E293B] hover:text-[#475569] shrink-0" />

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
              className={`w-10 h-6 rounded-full transition-colors relative overflow-hidden ${
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
