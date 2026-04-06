'use client'

/**
 * @컴포넌트: TestimonialsManager
 * @설명: 고객 후기(Testimonials) CRUD 관리
 */

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X, Star } from 'lucide-react'

interface Testimonial {
  id: string
  quote: string
  author_name: string
  author_title: string
  author_avatar: string | null
  rating: number
  is_published: boolean
}

interface Props {
  items: Testimonial[]
  onCreate: (data: Omit<Testimonial, 'id'>) => Promise<void>
  onUpdate: (id: string, data: Omit<Testimonial, 'id'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onTogglePublish: (id: string, published: boolean) => Promise<void>
}

const emptyForm = { quote: '', author_name: '', author_title: '', author_avatar: '', rating: 5, is_published: true }

export default function TestimonialsManager({ items: initItems, onCreate, onUpdate, onDelete, onTogglePublish }: Props) {
  const [items, setItems] = useState<Testimonial[]>(initItems)
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [newForm, setNewForm] = useState(emptyForm)

  function startEdit(t: Testimonial) {
    setEditingId(t.id)
    setForm({ quote: t.quote, author_name: t.author_name, author_title: t.author_title, author_avatar: t.author_avatar ?? '', rating: t.rating, is_published: t.is_published })
    setShowNew(false)
  }

  async function handleUpdate(id: string) {
    startTransition(async () => {
      await onUpdate(id, { ...form, author_avatar: form.author_avatar || null })
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...form } : t)))
      setEditingId(null)
    })
  }

  async function handleCreate() {
    if (!newForm.quote.trim() || !newForm.author_name.trim()) return
    startTransition(async () => {
      await onCreate({ ...newForm, author_avatar: newForm.author_avatar || null })
      setNewForm(emptyForm)
      setShowNew(false)
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this testimonial?')) return
    startTransition(async () => {
      await onDelete(id)
      setItems((prev) => prev.filter((t) => t.id !== id))
    })
  }

  async function handleToggle(id: string, current: boolean) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, is_published: !current } : t)))
    startTransition(() => onTogglePublish(id, !current))
  }

  function FormFields({ f, setF }: { f: typeof emptyForm, setF: (v: typeof emptyForm) => void }) {
    return (
      <div className="space-y-3">
        <textarea
          value={f.quote}
          onChange={(e) => setF({ ...f, quote: e.target.value })}
          rows={3}
          placeholder="Customer quote"
          className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-[#94A3B8] placeholder-[#475569] focus:outline-none focus:border-amber-500/50 resize-none"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            value={f.author_name}
            onChange={(e) => setF({ ...f, author_name: e.target.value })}
            placeholder="Author name"
            className="bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-amber-500/50"
          />
          <input
            value={f.author_title}
            onChange={(e) => setF({ ...f, author_title: e.target.value })}
            placeholder="Author title (e.g. CEO at ACME)"
            className="bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-[#475569]">Rating</label>
          <div className="flex gap-1">
            {[1,2,3,4,5].map((n) => (
              <button key={n} type="button" onClick={() => setF({ ...f, rating: n })}>
                <Star size={16} className={n <= f.rating ? 'text-amber-400 fill-current' : 'text-[#1E293B]'} />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isPending && <p className="text-xs text-amber-400">Saving…</p>}

      {items.map((t) => (
        <div key={t.id} className="border border-[#1E293B] bg-[#111A2E] rounded-xl overflow-hidden">
          {editingId === t.id ? (
            <div className="p-4 space-y-3">
              <FormFields f={form} setF={setForm} />
              <div className="flex gap-2">
                <button onClick={() => handleUpdate(t.id)} disabled={isPending} className="flex items-center gap-1.5 text-xs bg-amber-500 text-[#0B1120] font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors">
                  <Check size={12} /> Save
                </button>
                <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 text-xs text-[#94A3B8] border border-[#1E293B] px-3 py-1.5 rounded-lg hover:text-white transition-colors">
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex gap-0.5 mb-2">
                  {[1,2,3,4,5].map((n) => (
                    <Star key={n} size={11} className={n <= (t.rating ?? 5) ? 'text-amber-400 fill-current' : 'text-[#1E293B]'} />
                  ))}
                </div>
                <p className={`text-sm italic line-clamp-2 ${t.is_published ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>&ldquo;{t.quote}&rdquo;</p>
                <p className="text-xs text-[#475569] mt-1.5">{t.author_name} · {t.author_title}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleToggle(t.id, t.is_published)} className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${t.is_published ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-[#475569] bg-[#1E293B] border-[#1E293B]'}`}>
                  {t.is_published ? 'Published' : 'Draft'}
                </button>
                <button onClick={() => startEdit(t)} className="p-1.5 text-[#475569] hover:text-white rounded-lg hover:bg-[#1E293B] transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-1.5 text-[#475569] hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showNew ? (
        <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-4 space-y-3">
          <FormFields f={newForm} setF={setNewForm} />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={isPending || !newForm.quote.trim() || !newForm.author_name.trim()} className="flex items-center gap-1.5 text-xs bg-amber-500 text-[#0B1120] font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors">
              <Check size={12} /> Add Testimonial
            </button>
            <button onClick={() => { setShowNew(false); setNewForm(emptyForm) }} className="flex items-center gap-1.5 text-xs text-[#94A3B8] border border-[#1E293B] px-3 py-1.5 rounded-lg hover:text-white transition-colors">
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setShowNew(true); setEditingId(null) }} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[#1E293B] rounded-xl text-sm text-[#475569] hover:text-[#94A3B8] hover:border-[#38BDF8]/20 transition-colors">
          <Plus size={15} /> Add New Testimonial
        </button>
      )}
    </div>
  )
}
