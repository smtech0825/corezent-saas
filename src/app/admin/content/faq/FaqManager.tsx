'use client'

/**
 * @컴포넌트: FaqManager
 * @설명: FAQ CRUD 관리 — 추가/수정/삭제/순서 변경
 */

import { useState, useTransition } from 'react'
import nextDynamic from 'next/dynamic'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { richToPlainText } from '@/lib/rich-html'

// 답변은 제품 설명과 동일한 리치 에디터(TipTap) 재사용 — admin·클라이언트에서만 로드(ssr:false).
const RichTextEditor = nextDynamic(() => import('@/components/admin/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="border border-rule rounded-lg bg-paper h-48 animate-pulse" aria-hidden />,
})

interface Faq {
  id: string
  question: string
  answer: string
  is_published: boolean
  order_index: number
}

type CreatedFaq = { id: string; question: string; answer: string; is_published: boolean; order_index: number } | null

interface Props {
  faqs: Faq[]
  onCreate: (question: string, answer: string) => Promise<CreatedFaq>
  onUpdate: (id: string, question: string, answer: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onTogglePublish: (id: string, published: boolean) => Promise<void>
}

export default function FaqManager({ faqs, onCreate, onUpdate, onDelete, onTogglePublish }: Props) {
  const [items, setItems] = useState<Faq[]>(faqs)
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ question: '', answer: '' })
  const [newForm, setNewForm] = useState({ question: '', answer: '' })

  function startEdit(faq: Faq) {
    setEditingId(faq.id)
    setForm({ question: faq.question, answer: faq.answer })
    setShowNew(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ question: '', answer: '' })
  }

  async function handleUpdate(id: string) {
    if (!form.question.trim() || !form.answer.trim()) return
    startTransition(async () => {
      await onUpdate(id, form.question, form.answer)
      setItems((prev) =>
        prev.map((f) => (f.id === id ? { ...f, question: form.question, answer: form.answer } : f))
      )
      setEditingId(null)
    })
  }

  async function handleCreate() {
    if (!newForm.question.trim() || !newForm.answer.trim()) return
    startTransition(async () => {
      const created = await onCreate(newForm.question, newForm.answer)
      if (created) setItems((prev) => [...prev, created])
      setNewForm({ question: '', answer: '' })
      setShowNew(false)
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('이 FAQ를 삭제할까요?')) return
    startTransition(async () => {
      await onDelete(id)
      setItems((prev) => prev.filter((f) => f.id !== id))
    })
  }

  async function handleToggle(id: string, current: boolean) {
    setItems((prev) =>
      prev.map((f) => (f.id === id ? { ...f, is_published: !current } : f))
    )
    startTransition(() => onTogglePublish(id, !current))
  }

  return (
    <div className="space-y-3">
      {isPending && <p className="text-xs text-mark">저장 중…</p>}

      {items.map((faq) => (
        <div key={faq.id} className="border border-rule bg-paper-raised rounded-xl overflow-hidden">
          {editingId === faq.id ? (
            <div className="p-4 space-y-3">
              <input
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                className="w-full bg-paper border border-rule rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-mark"
                placeholder="질문"
              />
              <div>
                <label className="block text-xs text-ink-faint mb-1">답변</label>
                <RichTextEditor value={form.answer} onChange={(html) => setForm({ ...form, answer: html })} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdate(faq.id)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 text-xs bg-mark text-white font-semibold px-3 py-1.5 rounded-lg hover:brightness-95 disabled:opacity-50 transition-colors"
                >
                  <Check size={12} /> 저장
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 text-xs text-ink-soft border border-rule px-3 py-1.5 rounded-lg hover:text-ink transition-colors"
                >
                  <X size={12} /> 취소
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${faq.is_published ? 'text-ink' : 'text-ink-faint'}`}>
                    {faq.question}
                  </p>
                  <p className="text-xs text-ink-faint mt-1 line-clamp-2">{richToPlainText(faq.answer)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(faq.id, faq.is_published)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                      faq.is_published
                        ? 'text-ok bg-ok-soft border-ok/20'
                        : 'text-ink-soft bg-paper-shade border-rule'
                    }`}
                  >
                    {faq.is_published ? '게시됨' : '초안'}
                  </button>
                  <button
                    onClick={() => startEdit(faq)}
                    className="p-1.5 text-ink-faint hover:text-ink rounded-lg hover:bg-paper-shade transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(faq.id)}
                    className="p-1.5 text-ink-faint hover:text-danger rounded-lg hover:bg-danger-soft transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 새 FAQ 추가 폼 */}
      {showNew ? (
        <div className="border border-mark/30 bg-mark/5 rounded-xl p-4 space-y-3">
          <input
            value={newForm.question}
            onChange={(e) => setNewForm({ ...newForm, question: e.target.value })}
            className="w-full bg-paper border border-rule rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark"
            placeholder="질문"
            autoFocus
          />
          <div>
            <label className="block text-xs text-ink-faint mb-1">답변</label>
            <RichTextEditor value={newForm.answer} onChange={(html) => setNewForm({ ...newForm, answer: html })} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isPending || !newForm.question.trim() || !newForm.answer.trim()}
              className="flex items-center gap-1.5 text-xs bg-mark text-white font-semibold px-3 py-1.5 rounded-lg hover:brightness-95 disabled:opacity-50 transition-colors"
            >
              <Check size={12} /> FAQ 추가
            </button>
            <button
              onClick={() => { setShowNew(false); setNewForm({ question: '', answer: '' }) }}
              className="flex items-center gap-1.5 text-xs text-ink-soft border border-rule px-3 py-1.5 rounded-lg hover:text-ink transition-colors"
            >
              <X size={12} /> 취소
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowNew(true); setEditingId(null) }}
          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-rule rounded-xl text-sm text-ink-faint hover:text-ink-soft hover:border-mark/40 transition-colors"
        >
          <Plus size={15} /> 새 FAQ 추가
        </button>
      )}
    </div>
  )
}
