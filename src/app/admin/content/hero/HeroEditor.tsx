'use client'

/**
 * @컴포넌트: HeroEditor
 * @설명: Hero 섹션 텍스트 콘텐츠 편집기
 */

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'

interface HeroData {
  badge: string
  headline1: string
  headline2: string
  subtext: string
  cta1_text: string
  cta1_href: string
  cta2_text: string
  cta2_href: string
}

interface Props {
  initial: HeroData
  onSave: (data: HeroData) => Promise<void>
}

export default function HeroEditor({ initial, onSave }: Props) {
  const [form, setForm] = useState<HeroData>(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function set(key: keyof HeroData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleSave() {
    startTransition(async () => {
      await onSave(form)
      setSaved(true)
    })
  }

  const inputCls =
    'w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors'
  const labelCls = 'text-xs font-medium text-[#94A3B8]'

  return (
    <div className="space-y-5">
      {isPending && <p className="text-xs text-amber-400">Saving…</p>}
      {saved && !isPending && <p className="text-xs text-emerald-400">Saved successfully.</p>}

      <div className="space-y-1.5">
        <label className={labelCls}>Badge Text</label>
        <input value={form.badge} onChange={(e) => set('badge', e.target.value)} placeholder="Software built to make your work easier" className={inputCls} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelCls}>Headline Line 1</label>
          <input value={form.headline1} onChange={(e) => set('headline1', e.target.value)} placeholder="Powerful Software," className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Headline Line 2 (gradient)</label>
          <input value={form.headline2} onChange={(e) => set('headline2', e.target.value)} placeholder="Crafted with Care." className={inputCls} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Subtext</label>
        <textarea
          value={form.subtext}
          onChange={(e) => set('subtext', e.target.value)}
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelCls}>Primary CTA Text</label>
          <input value={form.cta1_text} onChange={(e) => set('cta1_text', e.target.value)} placeholder="Browse products" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Primary CTA Link</label>
          <input value={form.cta1_href} onChange={(e) => set('cta1_href', e.target.value)} placeholder="#product" className={inputCls} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelCls}>Secondary CTA Text</label>
          <input value={form.cta2_text} onChange={(e) => set('cta2_text', e.target.value)} placeholder="Create free account" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Secondary CTA Link</label>
          <input value={form.cta2_href} onChange={(e) => set('cta2_href', e.target.value)} placeholder="/auth/register" className={inputCls} />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          <Check size={14} />
          Save Hero
        </button>
      </div>
    </div>
  )
}
