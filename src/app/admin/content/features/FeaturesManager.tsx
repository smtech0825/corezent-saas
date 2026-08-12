'use client'

/**
 * @컴포넌트: FeaturesManager
 * @설명: 랜딩 페이지 Features 섹션 CRUD
 */

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { runAdminAction } from '@/app/admin/_lib/runAdminAction'
import type { AdminActionResult } from '@/app/admin/_lib/adminActionResult'

interface Feature {
  id: string
  icon: string
  tag: string
  title: string
  description: string
  is_published: boolean
  order_index: number
}

/** 서버가 돌려주는 추가 결과 — icon·tag는 비어 있을 수 있어 화면에서 빈 문자열로 맞춘다 */
type CreatedFeature = { id: string; icon: string | null; tag: string | null; title: string; description: string; is_published: boolean; order_index: number }

interface Props {
  features: Feature[]
  onCreate: (icon: string, tag: string, title: string, description: string) => Promise<AdminActionResult<CreatedFeature>>
  onUpdate: (id: string, icon: string, tag: string, title: string, description: string) => Promise<AdminActionResult>
  onDelete: (id: string) => Promise<AdminActionResult>
  onTogglePublish: (id: string, published: boolean) => Promise<AdminActionResult>
}

const emptyForm = { icon: '', tag: '', title: '', description: '' }

// ─── InputField — 컴포넌트 외부에 정의하여 리렌더링 시 포커스 손실 방지 ───
function InputField({ label, value, onChange, placeholder, multiline = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-ink-faint mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="w-full bg-paper border border-rule rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-paper border border-rule rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark"
        />
      )}
    </div>
  )
}

export default function FeaturesManager({ features, onCreate, onUpdate, onDelete, onTogglePublish }: Props) {
  const [items, setItems] = useState<Feature[]>(features)
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [newForm, setNewForm] = useState(emptyForm)

  function startEdit(f: Feature) {
    setEditingId(f.id)
    setForm({ icon: f.icon ?? '', tag: f.tag ?? '', title: f.title, description: f.description })
    setShowNew(false)
  }

  async function handleUpdate(id: string) {
    startTransition(async () => {
      // 실패하면 편집 상태를 닫지 않는다 — 작성 중이던 내용이 날아가면 안 된다.
      const res = await runAdminAction('특징 수정', () => onUpdate(id, form.icon, form.tag, form.title, form.description))
      if (res.status !== 'ok') return
      setItems((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...form } : f))
      )
      setEditingId(null)
    })
  }

  async function handleCreate() {
    if (!newForm.title.trim()) return
    startTransition(async () => {
      const res = await runAdminAction('특징 추가', () => onCreate(newForm.icon, newForm.tag, newForm.title, newForm.description))
      if (res.status !== 'ok') return
      const created = res.created
      if (created) setItems((prev) => [...prev, { ...created, icon: created.icon ?? '', tag: created.tag ?? '' }])
      setNewForm(emptyForm)
      setShowNew(false)
    })
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`특징 "${title}"을(를) 삭제할까요?\n\n랜딩 페이지에서 바로 사라지며 되돌릴 수 없습니다.`)) return
    startTransition(async () => {
      // 서버가 실패하면 목록에서 지우지 않는다 — 지워지면 삭제된 것으로 오해한다.
      const res = await runAdminAction('특징 삭제', () => onDelete(id))
      if (res.status !== 'ok') return
      setItems((prev) => prev.filter((f) => f.id !== id))
    })
  }

  async function handleToggle(id: string) {
    // 연타 방지 — 처리 중에는 아무것도 받지 않는다(버튼도 비활성이지만 한 번 더 막는다).
    if (isPending) return
    // 되돌릴 기준은 "직전에 눌렀을 때의 값"이 아니라 지금 서버에 남아 있는 값이다.
    const serverValue = items.find((f) => f.id === id)?.is_published
    if (serverValue === undefined) return
    const next = !serverValue

    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, is_published: next } : f)))
    startTransition(async () => {
      // 실패하면 화면 표시를 서버 값으로 되돌린다.
      const res = await runAdminAction('게시 상태 변경', () => onTogglePublish(id, next))
      if (res.status !== 'ok') setItems((prev) => prev.map((f) => (f.id === id ? { ...f, is_published: serverValue } : f)))
    })
  }

  return (
    <div className="space-y-3">
      {isPending && <p className="text-xs text-mark">저장 중…</p>}

      {items.map((feature) => (
        <div key={feature.id} className="border border-rule bg-paper-raised rounded-card overflow-hidden">
          {editingId === feature.id ? (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField label="아이콘 (lu: / tb: / ri: / svg)" value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} placeholder="Zap · tb:Cpu · ri:Star · <svg>..." />
                <InputField label="태그 (대문자 라벨)" value={form.tag} onChange={(v) => setForm({ ...form, tag: v })} placeholder="자체 개발 · 즉시 · 문서" />
              </div>
              <InputField label="제목" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="특징 제목" />
              <InputField label="설명" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="특징 설명" multiline />
              <div className="flex gap-2">
                <button onClick={() => handleUpdate(feature.id)} disabled={isPending} className="flex items-center gap-1.5 text-xs bg-mark text-white font-semibold px-3 py-1.5 rounded-lg hover:brightness-95 disabled:opacity-50 transition-colors">
                  저장
                </button>
                <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 text-xs text-ink-soft border border-rule px-3 py-1.5 rounded-lg hover:text-ink transition-colors">
                  <X size={12} /> 취소
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {feature.icon && (
                  <span className="w-8 h-8 rounded-lg bg-mark/10 border border-mark/30 flex items-center justify-center text-xs text-mark font-mono shrink-0">
                    {feature.icon.slice(0, 2)}
                  </span>
                )}
                <div className="min-w-0">
                  {feature.tag && (
                    <p className="text-[10px] text-ink-faint font-mono uppercase tracking-wider mb-0.5">{feature.tag}</p>
                  )}
                  <p className={`text-sm font-medium ${feature.is_published ? 'text-ink' : 'text-ink-faint'}`}>{feature.title}</p>
                  <p className="text-xs text-ink-faint mt-1 line-clamp-2">{feature.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleToggle(feature.id)} disabled={isPending} className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors disabled:opacity-50 ${feature.is_published ? 'text-ok bg-ok-soft border-ok/20' : 'text-ink-soft bg-paper-shade border-rule'}`}>
                  {feature.is_published ? '게시됨' : '초안'}
                </button>
                <button onClick={() => startEdit(feature)} title="특징 수정" aria-label="특징 수정" className="p-1.5 text-ink-faint hover:text-ink rounded-lg hover:bg-paper-shade transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(feature.id, feature.title)} title="특징 삭제" aria-label="특징 삭제" className="p-1.5 text-ink-faint hover:text-danger rounded-lg hover:bg-danger-soft transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showNew ? (
        <div className="border border-mark/30 bg-mark/5 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="아이콘 (lu: / tb: / ri: / svg)" value={newForm.icon} onChange={(v) => setNewForm({ ...newForm, icon: v })} placeholder="Zap · tb:Cpu · ri:Star · <svg>..." />
            <InputField label="태그 (대문자 라벨)" value={newForm.tag} onChange={(v) => setNewForm({ ...newForm, tag: v })} placeholder="자체 개발 · 즉시 · 문서" />
          </div>
          <InputField label="제목" value={newForm.title} onChange={(v) => setNewForm({ ...newForm, title: v })} placeholder="특징 제목" />
          <InputField label="설명" value={newForm.description} onChange={(v) => setNewForm({ ...newForm, description: v })} placeholder="특징 설명" multiline />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={isPending || !newForm.title.trim()} className="flex items-center gap-1.5 text-xs bg-mark text-white font-semibold px-3 py-1.5 rounded-lg hover:brightness-95 disabled:opacity-50 transition-colors">
              특징 추가
            </button>
            <button onClick={() => { setShowNew(false); setNewForm(emptyForm) }} className="flex items-center gap-1.5 text-xs text-ink-soft border border-rule px-3 py-1.5 rounded-lg hover:text-ink transition-colors">
              <X size={12} /> 취소
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setShowNew(true); setEditingId(null) }} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-rule rounded-xl text-sm text-ink-faint hover:text-ink-soft hover:border-mark/30 transition-colors">
          <Plus size={15} /> 새 특징 추가
        </button>
      )}
    </div>
  )
}
