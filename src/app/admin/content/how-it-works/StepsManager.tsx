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

interface Props {
  items: Step[]
  onCreate: (data: Omit<Step, 'id'>) => Promise<void>
  onUpdate: (id: string, data: Omit<Step, 'id'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onTogglePublish: (id: string, published: boolean) => Promise<void>
}

const emptyForm = { icon: 'Zap', title: '', description: '', is_published: true, order_index: 0 }

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
      await onCreate(next)
      setNewForm(emptyForm)
      setShowNew(false)
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this step?')) return
    startTransition(async () => {
      await onDelete(id)
      setItems((prev) => prev.filter((s) => s.id !== id))
    })
  }

  async function handleToggle(id: string, current: boolean) {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, is_published: !current } : s)))
    startTransition(() => onTogglePublish(id, !current))
  }

  const inputCls = 'w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-amber-500/50'

  function FormFields({ f, setF }: { f: typeof emptyForm; setF: (v: typeof emptyForm) => void }) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-[#475569] mb-1 block">Icon (Lucide PascalCase)</label>
            <input
              value={f.icon}
              onChange={(e) => setF({ ...f, icon: e.target.value })}
              placeholder="e.g. ShoppingCart, Zap, Star"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-[10px] text-[#475569] mb-1 block">Title</label>
            <input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder="Step title"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-[#475569] mb-1 block">Description</label>
          <textarea
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            rows={3}
            placeholder="Step description"
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isPending && <p className="text-xs text-amber-400">Saving…</p>}

      {items.map((s, idx) => (
        <div key={s.id} className="border border-[#1E293B] bg-[#111A2E] rounded-xl overflow-hidden">
          {editingId === s.id ? (
            <div className="p-4 space-y-3">
              <FormFields f={form} setF={setForm} />
              <div className="flex gap-2">
                <button onClick={() => handleUpdate(s.id)} disabled={isPending} className="flex items-center gap-1.5 text-xs bg-amber-500 text-[#0B1120] font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors">
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
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-[#38BDF8]/60 font-bold">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs text-[#475569] font-mono">{s.icon}</span>
                </div>
                <p className={`text-sm font-medium ${s.is_published ? 'text-white' : 'text-[#475569]'}`}>{s.title}</p>
                <p className="text-xs text-[#475569] mt-0.5 line-clamp-2">{s.description}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleToggle(s.id, s.is_published)} className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${s.is_published ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-[#475569] bg-[#1E293B] border-[#1E293B]'}`}>
                  {s.is_published ? 'Published' : 'Draft'}
                </button>
                <button onClick={() => startEdit(s)} className="p-1.5 text-[#475569] hover:text-white rounded-lg hover:bg-[#1E293B] transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 text-[#475569] hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-colors">
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
            <button onClick={handleCreate} disabled={isPending || !newForm.title.trim()} className="flex items-center gap-1.5 text-xs bg-amber-500 text-[#0B1120] font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors">
              <Check size={12} /> Add Step
            </button>
            <button onClick={() => { setShowNew(false); setNewForm(emptyForm) }} className="flex items-center gap-1.5 text-xs text-[#94A3B8] border border-[#1E293B] px-3 py-1.5 rounded-lg hover:text-white transition-colors">
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setShowNew(true); setEditingId(null) }} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[#1E293B] rounded-xl text-sm text-[#475569] hover:text-[#94A3B8] hover:border-[#38BDF8]/20 transition-colors">
          <Plus size={15} /> Add New Step
        </button>
      )}
    </div>
  )
}
