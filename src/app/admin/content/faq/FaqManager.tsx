'use client'

/**
 * @컴포넌트: FaqManager
 * @설명: FAQ CRUD 관리 — 추가/수정/삭제/순서 변경
 */

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface Faq {
  id: string
  question: string
  answer: string
  is_published: boolean
  order_index: number
}

interface Props {
  faqs: Faq[]
  onCreate: (question: string, answer: string) => Promise<void>
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
      await onCreate(newForm.question, newForm.answer)
      setNewForm({ question: '', answer: '' })
      setShowNew(false)
      // 새 항목은 서버에서 revalidate됨
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this FAQ?')) return
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
      {isPending && <p className="text-xs text-amber-400">Saving…</p>}

      {items.map((faq) => (
        <div key={faq.id} className="border border-[#1E293B] bg-[#111A2E] rounded-xl overflow-hidden">
          {editingId === faq.id ? (
            <div className="p-4 space-y-3">
              <input
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                placeholder="Question"
              />
              <textarea
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                rows={3}
                className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-[#94A3B8] focus:outline-none focus:border-amber-500/50 resize-none"
                placeholder="Answer"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdate(faq.id)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 text-xs bg-amber-500 text-[#0B1120] font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
                >
                  <Check size={12} /> Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 text-xs text-[#94A3B8] border border-[#1E293B] px-3 py-1.5 rounded-lg hover:text-white transition-colors"
                >
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${faq.is_published ? 'text-white' : 'text-[#475569]'}`}>
                    {faq.question}
                  </p>
                  <p className="text-xs text-[#475569] mt-1 line-clamp-2">{faq.answer}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(faq.id, faq.is_published)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                      faq.is_published
                        ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                        : 'text-[#475569] bg-[#1E293B] border-[#1E293B]'
                    }`}
                  >
                    {faq.is_published ? 'Published' : 'Draft'}
                  </button>
                  <button
                    onClick={() => startEdit(faq)}
                    className="p-1.5 text-[#475569] hover:text-white rounded-lg hover:bg-[#1E293B] transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(faq.id)}
                    className="p-1.5 text-[#475569] hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-colors"
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
        <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-4 space-y-3">
          <input
            value={newForm.question}
            onChange={(e) => setNewForm({ ...newForm, question: e.target.value })}
            className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-amber-500/50"
            placeholder="Question"
            autoFocus
          />
          <textarea
            value={newForm.answer}
            onChange={(e) => setNewForm({ ...newForm, answer: e.target.value })}
            rows={3}
            className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-[#94A3B8] placeholder-[#475569] focus:outline-none focus:border-amber-500/50 resize-none"
            placeholder="Answer"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isPending || !newForm.question.trim() || !newForm.answer.trim()}
              className="flex items-center gap-1.5 text-xs bg-amber-500 text-[#0B1120] font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              <Check size={12} /> Add FAQ
            </button>
            <button
              onClick={() => { setShowNew(false); setNewForm({ question: '', answer: '' }) }}
              className="flex items-center gap-1.5 text-xs text-[#94A3B8] border border-[#1E293B] px-3 py-1.5 rounded-lg hover:text-white transition-colors"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowNew(true); setEditingId(null) }}
          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[#1E293B] rounded-xl text-sm text-[#475569] hover:text-[#94A3B8] hover:border-[#38BDF8]/20 transition-colors"
        >
          <Plus size={15} /> Add New FAQ
        </button>
      )}
    </div>
  )
}
