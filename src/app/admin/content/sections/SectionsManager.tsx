'use client'

/**
 * @컴포넌트: SectionsManager
 * @설명: 랜딩 페이지 섹션 가시성 및 순서 관리
 *        - 토글 → /api/admin/sections/toggle (upsert: 전체 필드 전송)
 *        - 드래그 → /api/admin/sections/reorder (upsert: 전체 필드 전송)
 *        - 낙관적 UI: 즉시 반영 후 실패 시 롤백
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
  function handleToggle(idx: number) {
    // 연타 방지 — 처리 중에는 아무것도 받지 않는다(버튼도 비활성이지만 한 번 더 막는다).
    if (isPending) return
    const section = items[idx]
    if (!section) return
    // 되돌릴 기준은 "직전에 눌렀을 때의 값"이 아니라 지금 서버에 남아 있는 값이다.
    const serverValue = section.is_visible
    const next = !serverValue

    // 낙관적 업데이트
    setItems((prev) => prev.map((s, i) => (i === idx ? { ...s, is_visible: next } : s)))
    setSaveError(null)

    startTransition(async () => {
      // 되돌리기와 오류 표시를 한 곳에 모은다 — 연결이 끊겨 fetch가 예외를 던지면
      // 예전에는 아무 표시 없이 화면만 바뀐 채 남아, 실제 랜딩과 어긋났다.
      const rollback = (message: string) => {
        setItems((prev) => prev.map((s, i) => (i === idx ? { ...s, is_visible: serverValue } : s)))
        setSaveError(message)
      }

      try {
        const res = await fetch('/api/admin/sections/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: section.name,
            is_visible: next,
            label: section.label,
            order_index: section.order_index,
          }),
        })
        if (!res.ok) rollback('표시 여부 변경에 실패했습니다. 다시 시도해 주세요.')
      } catch (err) {
        console.error('[SectionsManager] 표시 여부 변경 요청 실패:', err)
        rollback('표시 여부 변경 요청을 보내지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')
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
    // 처리 중에는 순서도 바꾸지 않는다 — 토글만 막고 드래그를 열어두면, 아직 서버가 받아들이지
    // 않은 표시/숨김 값이 순서 저장에 그대로 실려 화면과 실제 사이트가 어긋난다.
    if (isPending) {
      setDragging(null)
      setDragOver(null)
      return
    }
    if (dragging === null || dragging === toIdx) {
      setDragging(null)
      setDragOver(null)
      return
    }

    const prev = [...items]
    const reordered = [...items]
    const [moved] = reordered.splice(dragging, 1)
    reordered.splice(toIdx, 0, moved)
    // order_index 재정렬
    const updated = reordered.map((s, i) => ({ ...s, order_index: i }))
    setItems(updated)
    setDragging(null)
    setDragOver(null)
    setSaveError(null)

    startTransition(async () => {
      // 토글과 같은 처리 — 연결이 끊겨도 되돌리고 오류를 알린다.
      const rollback = (message: string) => {
        setItems(prev)
        setSaveError(message)
      }

      try {
        const res = await fetch('/api/admin/sections/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sections: updated.map((s) => ({
              name: s.name,
              label: s.label,
              is_visible: s.is_visible,
            })),
          }),
        })
        if (!res.ok) rollback('순서 변경에 실패했습니다. 다시 시도해 주세요.')
      } catch (err) {
        console.error('[SectionsManager] 순서 변경 요청 실패:', err)
        rollback('순서 변경 요청을 보내지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')
      }
    })
  }

  return (
    <div className="space-y-2">
      {/* 상태 메시지 */}
      {isPending && <p className="text-xs text-mark px-1">저장 중…</p>}
      {saveError && !isPending && (
        <p className="text-xs text-danger px-1">{saveError}</p>
      )}

      {items.map((section, idx) => (
        <div
          key={section.name}
          draggable={!isPending}
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={() => { setDragging(null); setDragOver(null) }}
          className={[
            'flex items-center gap-4 px-5 py-4 border rounded-xl cursor-grab active:cursor-grabbing transition-all',
            dragOver === idx
              ? 'border-mark/40 bg-mark/5'
              : 'border-rule bg-paper-raised hover:border-rule',
            dragging === idx ? 'opacity-40' : 'opacity-100',
          ].join(' ')}
        >
          <GripVertical size={16} className="text-ink-faint hover:text-ink-soft shrink-0" />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink">{section.label}</p>
            <p className="text-xs text-ink-faint font-mono">{section.name}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${section.is_visible ? 'text-ok' : 'text-ink-soft'}`}>
              {section.is_visible ? '표시' : '숨김'}
            </span>
            <button
              onClick={() => handleToggle(idx)}
              disabled={isPending}
              className={`w-10 h-6 rounded-full transition-colors relative overflow-hidden disabled:opacity-60 ${
                section.is_visible ? 'bg-ok' : 'bg-paper-shade'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  section.is_visible ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
            {section.is_visible ? (
              <Eye size={14} className="text-ok" />
            ) : (
              <EyeOff size={14} className="text-ink-soft" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
