'use client'

/**
 * @컴포넌트: StepsManager
 * @설명: How It Works 섹션 단계 항목 CRUD 관리
 */

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface Step {
  id: string
  icon: string
  title: string
  description: string
  is_published: boolean
  order_index: number
}

type CreatedStep = { id: string; icon: string; title: string; description: string; is_published: boolean; order_index: number } | null

interface Props {
  items: Step[]
  onCreate: (data: Omit<Step, 'id'>) => Promise<CreatedStep>
  onUpdate: (id: string, data: Omit<Step, 'id'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onTogglePublish: (id: string, published: boolean) => Promise<void>
}

const emptyForm = { icon: 'Zap', title: '', description: '', is_published: true, order_index: 0 }

// ─── 모듈 레벨 상수 — 리렌더링 시 포커스 손실 방지 ───────────────────────
const inputCls = 'w-full bg-paper border border-rule rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark'

// ─── FormFields — 컴포넌트 외부에 정의하여 unmount/remount 방지 ──────────
function FormFields({ f, setF }: { f: typeof emptyForm; setF: (v: typeof emptyForm) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-ink-faint mb-1 block">아이콘  (lu: / tb: / ri: / &lt;svg&gt;)</label>
          <input
            value={f.icon}
            onChange={(e) => setF({ ...f, icon: e.target.value })}
            placeholder="Zap · tb:Cpu · ri:Star · <svg>..."
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-[10px] text-ink-faint mb-1 block">제목</label>
          <input
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="단계 제목"
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-ink-faint mb-1 block">설명</label>
        <textarea
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          rows={3}
          placeholder="단계 설명"
          className={`${inputCls} resize-none`}
        />
      </div>
    </div>
  )
}

export default function StepsManager({ items: initItems, onCreate, onUpdate, onDelete, onTogglePublish }: Props) {
  const [items, setItems] = useState<Step[]>(initItems)
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [newForm, setNewForm] = useState(emptyForm)

  function startEdit(s: Step) {
    setEditingId(s.id)
    setForm({ icon: s.icon, title: s.title, description: s.description, is_published: s.is_published, order_index: s.order_index })
    setShowNew(false)
  }

  async function handleUpdate(id: string) {
    startTransition(async () => {
      await onUpdate(id, form)
      setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...form } : s)))
      setEditingId(null)
    })
  }

  async function handleCreate() {
    if (!newForm.title.trim()) return
    const next = { ...newForm, order_index: items.length }
    startTransition(async () => {
      const created = await onCreate(next)
      if (created) setItems((prev) => [...prev, created])
      setNewForm(emptyForm)
      setShowNew(false)
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('이 단계를 삭제할까요?')) return
    startTransition(async () => {
      await onDelete(id)
      setItems((prev) => prev.filter((s) => s.id !== id))
    })
  }

  async function handleToggle(id: string, current: boolean) {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, is_published: !current } : s)))
    startTransition(() => onTogglePublish(id, !current))
  }

  return (
    <div className="space-y-3">
      {isPending && <p className="text-xs text-mark">저장 중…</p>}

      {items.map((s, idx) => (
        <div key={s.id} className="border border-rule bg-paper-raised rounded-xl overflow-hidden">
          {editingId === s.id ? (
            <div className="p-4 space-y-3">
              <FormFields f={form} setF={setForm} />
              <div className="flex gap-2">
                <button onClick={() => handleUpdate(s.id)} disabled={isPending} className="flex items-center gap-1.5 text-xs bg-mark text-white font-semibold px-3 py-1.5 rounded-lg hover:brightness-95 disabled:opacity-50 transition-colors">
                  <Check size={12} /> 저장
                </button>
                <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 text-xs text-ink-soft border border-rule px-3 py-1.5 rounded-lg hover:text-ink transition-colors">
                  <X size={12} /> 취소
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-mark/60 font-bold">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs text-ink-faint font-mono">{s.icon}</span>
                </div>
                <p className={`text-sm font-medium ${s.is_published ? 'text-ink' : 'text-ink-faint'}`}>{s.title}</p>
                <p className="text-xs text-ink-faint mt-0.5 line-clamp-2">{s.description}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleToggle(s.id, s.is_published)} className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${s.is_published ? 'text-ok bg-ok-soft border-ok/20' : 'text-ink-soft bg-paper-shade border-rule'}`}>
                  {s.is_published ? '게시됨' : '초안'}
                </button>
                <button onClick={() => startEdit(s)} className="p-1.5 text-ink-faint hover:text-ink rounded-lg hover:bg-paper-shade transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 text-ink-faint hover:text-danger rounded-lg hover:bg-danger-soft transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showNew ? (
        <div className="border border-mark/30 bg-mark/5 rounded-xl p-4 space-y-3">
          <FormFields f={newForm} setF={setNewForm} />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={isPending || !newForm.title.trim()} className="flex items-center gap-1.5 text-xs bg-mark text-white font-semibold px-3 py-1.5 rounded-lg hover:brightness-95 disabled:opacity-50 transition-colors">
              <Check size={12} /> 단계 추가
            </button>
            <button onClick={() => { setShowNew(false); setNewForm(emptyForm) }} className="flex items-center gap-1.5 text-xs text-ink-soft border border-rule px-3 py-1.5 rounded-lg hover:text-ink transition-colors">
              <X size={12} /> 취소
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setShowNew(true); setEditingId(null) }} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-rule rounded-xl text-sm text-ink-faint hover:text-ink-soft hover:border-mark/30 transition-colors">
          <Plus size={15} /> 새 단계 추가
        </button>
      )}
    </div>
  )
}
