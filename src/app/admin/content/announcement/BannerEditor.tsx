'use client'

/**
 * @컴포넌트: BannerEditor
 * @설명: 상단 공지 배너 콘텐츠 편집기
 */

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'

interface BannerData {
  text: string
  text_mobile: string
  link_text: string
  link_url: string
  visible: string
}

interface Props {
  initial: BannerData
  onSave: (data: BannerData) => Promise<void>
}

export default function BannerEditor({ initial, onSave }: Props) {
  const [form, setForm] = useState<BannerData>(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function set(key: keyof BannerData, value: string) {
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

      {/* 표시 여부 */}
      <div className="space-y-1.5">
        <label className={labelCls}>Banner Visible</label>
        <select
          value={form.visible}
          onChange={(e) => set('visible', e.target.value)}
          className={`${inputCls} cursor-pointer`}
        >
          <option value="true">Visible</option>
          <option value="false">Hidden</option>
        </select>
      </div>

      {/* 데스크톱 텍스트 */}
      <div className="space-y-1.5">
        <label className={labelCls}>Banner Text (Desktop)</label>
        <input
          value={form.text}
          onChange={(e) => set('text', e.target.value)}
          placeholder="Introducing GeniePost — AI-powered WordPress posting, starting at $9/month."
          className={inputCls}
        />
      </div>

      {/* 모바일 텍스트 */}
      <div className="space-y-1.5">
        <label className={labelCls}>Banner Text (Mobile)</label>
        <input
          value={form.text_mobile}
          onChange={(e) => set('text_mobile', e.target.value)}
          placeholder="GeniePost is here — AI WordPress posting from $9/mo."
          className={inputCls}
        />
      </div>

      {/* 링크 텍스트 + URL */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelCls}>Link Text</label>
          <input
            value={form.link_text}
            onChange={(e) => set('link_text', e.target.value)}
            placeholder="Learn more →"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Link URL</label>
          <input
            value={form.link_url}
            onChange={(e) => set('link_url', e.target.value)}
            placeholder="#product"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          <Check size={14} />
          Save Banner
        </button>
      </div>
    </div>
  )
}
