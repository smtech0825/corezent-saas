'use client'

/**
 * @컴포넌트: CtaEditor
 * @설명: CTA 섹션 텍스트 콘텐츠 편집기
 */

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'

interface CtaData {
  eyebrow: string
  headline: string
  subtext: string
  btn1_text: string
  btn1_href: string
  btn2_text: string
  btn2_href: string
  footnote: string
}

interface Props {
  initial: CtaData
  onSave: (data: CtaData) => Promise<void>
}

export default function CtaEditor({ initial, onSave }: Props) {
  const [form, setForm] = useState<CtaData>(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function set(key: keyof CtaData, value: string) {
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
        <label className={labelCls}>Eyebrow (small label above headline)</label>
        <input value={form.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Get started today" className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Headline</label>
        <input value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder="Find the right tool for your work." className={inputCls} />
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
          <label className={labelCls}>Primary Button Text</label>
          <input value={form.btn1_text} onChange={(e) => set('btn1_text', e.target.value)} placeholder="Browse products" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Primary Button Link</label>
          <input value={form.btn1_href} onChange={(e) => set('btn1_href', e.target.value)} placeholder="#product" className={inputCls} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelCls}>Secondary Button Text</label>
          <input value={form.btn2_text} onChange={(e) => set('btn2_text', e.target.value)} placeholder="Create free account →" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Secondary Button Link</label>
          <input value={form.btn2_href} onChange={(e) => set('btn2_href', e.target.value)} placeholder="/auth/register" className={inputCls} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Footnote (small text below buttons)</label>
        <input value={form.footnote} onChange={(e) => set('footnote', e.target.value)} placeholder="No credit card required · Instant activation" className={inputCls} />
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          <Check size={14} />
          Save CTA
        </button>
      </div>
    </div>
  )
}
