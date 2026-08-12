'use client'

/**
 * @컴포넌트: BannerEditor
 * @설명: 상단 공지 배너 콘텐츠 편집기
 */

import { useState, useTransition } from 'react'
import SaveAndViewButton from '@/app/admin/content/_components/SaveAndViewButton'
import { runAdminAction } from '@/app/admin/_lib/runAdminAction'
import SelectField from '@/components/common/SelectField'
import type { AdminActionResult } from '@/app/admin/_lib/adminActionResult'

interface BannerData {
  text: string
  text_mobile: string
  link_text: string
  link_url: string
  visible: string
}

interface Props {
  initial: BannerData
  onSave: (data: BannerData) => Promise<AdminActionResult>
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
      // 실패해도 입력값은 그대로 두고 "저장됨" 표시만 켜지 않는다.
      const res = await runAdminAction('배너 저장', () => onSave(form))
      if (res.status !== 'ok') return
      setSaved(true)
    })
  }

  const inputCls =
    'w-full bg-paper border border-rule rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark focus:ring-1 focus:ring-mark/20 transition-colors'
  const labelCls = 'text-xs font-medium text-ink-soft'

  return (
    <div className="space-y-5">
      {isPending && <p className="text-xs text-mark">저장 중…</p>}
      {saved && !isPending && <p className="text-xs text-ok">저장되었습니다.</p>}

      {/* 표시 여부 */}
      <div className="space-y-1.5">
        <label className={labelCls}>배너 표시</label>
        <SelectField
          size="md"
          value={form.visible}
          onChange={(e) => set('visible', e.target.value)}
        >
          <option value="true">표시</option>
          <option value="false">숨김</option>
        </SelectField>
      </div>

      {/* 데스크톱 텍스트 */}
      <div className="space-y-1.5">
        <label className={labelCls}>배너 텍스트 (데스크톱)</label>
        <input
          value={form.text}
          onChange={(e) => set('text', e.target.value)}
          placeholder="Introducing GeniePost — AI-powered WordPress posting, starting at $9/month."
          className={inputCls}
        />
      </div>

      {/* 모바일 텍스트 */}
      <div className="space-y-1.5">
        <label className={labelCls}>배너 텍스트 (모바일)</label>
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
          <label className={labelCls}>링크 텍스트</label>
          <input
            value={form.link_text}
            onChange={(e) => set('link_text', e.target.value)}
            placeholder="Learn more →"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>링크 URL</label>
          <input
            value={form.link_url}
            onChange={(e) => set('link_url', e.target.value)}
            placeholder="#product"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2.5 pt-2">
        {/* 저장 성공 시에만 홈(/)을 새 탭으로 — 기존 저장 버튼 동작은 그대로(버튼 추가일 뿐) */}
        <SaveAndViewButton
          url="/"
          label="배너 저장"
          onSave={async () => {
            const res = await onSave(form)
            if (res.status === 'ok') setSaved(true)
            return res
          }}
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-mark hover:brightness-95 text-white font-semibold text-sm px-5 py-3 sm:py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          배너 저장
        </button>
      </div>
    </div>
  )
}
