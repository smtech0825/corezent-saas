'use client'

/**
 * @컴포넌트: FeaturesManager
 * @설명: 랜딩 페이지 Features 섹션 CRUD
 */

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface Feature {
  id: string
  icon: string
  title: string
  description: string
  is_published: boolean
  order_index: number
}

interface Props {
  features: Feature[]
  onCreate: (icon: string, title: string, description: string) => Promise<void>
  onUpdate: (id: string, icon: string, title: string, description: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onTogglePublish: (id: string, published: boolean) => Promise<void>
}

const emptyForm = { icon: '', title: '', description: '' }

export default function FeaturesManager({ features, onCreate, onUpdate, onDelete, onTogglePublish }: Props) {
  const [items, setItems] = useState<Feature[]>(features)
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [newForm, setNewForm] = useState(emptyForm)

  function startEdit(f: Feature) {
    setEditingId(f.id)
    setForm({ icon: f.icon ?? '', title: f.title, description: f.description })
    setShowNew(false)
  }

  async function handleUpdate(id: string) {
    startTransition(async () => {
      await onUpdate(id, form.icon, form.title, form.description)
      setItems((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...form } : f))
      )
      setEditingId(null)
    })
  }

  async function handleCreate() {
    if (!newForm.title.trim()) return
    startTransition(async () => {
      await onCreate(newForm.icon, newForm.title, newForm.description)
      setNewForm(emptyForm)
      setShowNew(false)
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this feature?')) return
    startTransition(async () => {
      await onDelete(id)
      setItems((prev) => prev.filter((f) => f.id !== id))
    })
  }

  async function handleToggle(id: string, current: boolean) {
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, is_published: !current } : f)))
    startTransition(() => onTogglePublish(id, !current))
  }

  const InputField = ({ label, value, onChange, placeholder, multiline = false }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean
  }) => (
    <div>
      <label className="block text-xs text-[#475569] mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-[#94A3B8] placeholder-[#475569] focus:outline-none focus:border-amber-500/50 resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-amber-500/50"
        />
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      {isPending && <p className="text-xs text-amber-400">Saving…</p>}

      {items.map((feature) => (
        <div key={feature.id} className="border border-[#1E293B] bg-[#111A2E] rounded-xl overflow-hidden">
          {editingId === feature.id ? (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Icon (lucide name)" value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} placeholder="e.g. Zap" />
                <InputField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Feature title" />
              </div>
              <InputField label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Feature description" multiline />
              <div className="flex gap-2">
                <button onClick={() => handleUpdate(feature.id)} disabled={isPending} className="flex items-center gap-1.5 text-xs bg-amber-500 text-[#0B1120] font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors">
                  <Check size={12} /> Save
                </button>
                <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 text-xs text-[#94A3B8] border border-[#1E293B] px-3 py-1.5 rounded-lg hover:text-white transition-colors">
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {feature.icon && (
                  <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-xs text-[#38BDF8] font-mono shrink-0">
                    {feature.icon.slice(0, 2)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${feature.is_published ? 'text-white' : 'text-[#475569]'}`}>{feature.title}</p>
                  <p className="text-xs text-[#475569] mt-1 line-clamp-2">{feature.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleToggle(feature.id, feature.is_published)} className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${feature.is_published ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-[#475569] bg-[#1E293B] border-[#1E293B]'}`}>
                  {feature.is_published ? 'Published' : 'Draft'}
                </button>
                <button onClick={() => startEdit(feature)} className="p-1.5 text-[#475569] hover:text-white rounded-lg hover:bg-[#1E293B] transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(feature.id)} className="p-1.5 text-[#475569] hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showNew ? (
        <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Icon (lucide name)" value={newForm.icon} onChange={(v) => setNewForm({ ...newForm, icon: v })} placeholder="e.g. Zap" />
            <InputField label="Title" value={newForm.title} onChange={(v) => setNewForm({ ...newForm, title: v })} placeholder="Feature title" />
          </div>
          <InputField label="Description" value={newForm.description} onChange={(v) => setNewForm({ ...newForm, description: v })} placeholder="Feature description" multiline />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={isPending || !newForm.title.trim()} className="flex items-center gap-1.5 text-xs bg-amber-500 text-[#0B1120] font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors">
              <Check size={12} /> Add Feature
            </button>
            <button onClick={() => { setShowNew(false); setNewForm(emptyForm) }} className="flex items-center gap-1.5 text-xs text-[#94A3B8] border border-[#1E293B] px-3 py-1.5 rounded-lg hover:text-white transition-colors">
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setShowNew(true); setEditingId(null) }} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[#1E293B] rounded-xl text-sm text-[#475569] hover:text-[#94A3B8] hover:border-[#38BDF8]/20 transition-colors">
          <Plus size={15} /> Add New Feature
        </button>
      )}
    </div>
  )
}
