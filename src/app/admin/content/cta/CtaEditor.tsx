'use client'

/**
 * @컴포넌트: CtaEditor
 * @설명: CTA 섹션 텍스트 콘텐츠 편집기
 */

import { useState, useTransition } from 'react'
import SaveAndViewButton from '@/app/admin/content/_components/SaveAndViewButton'
import { runAdminAction } from '@/app/admin/_lib/runAdminAction'
import type { AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { CTA_DEFAULTS } from '@/lib/front-defaults'

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
  onSave: (data: CtaData) => Promise<AdminActionResult>
}

export default function CtaEditor({ initial, onSave }: Props) {
  const [form, setForm] = useState<CtaData>(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  // '저장 후 보기' 버튼이 저장 중인 동안 기존 저장 버튼도 잠근다(이중 저장 방지)
  const [viewSaving, setViewSaving] = useState(false)

  function set(key: keyof CtaData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleSave() {
    startTransition(async () => {
      // 실패해도 입력값은 그대로 두고 "저장됨" 표시만 켜지 않는다.
      const res = await runAdminAction('CTA 저장', () => onSave(form))
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

      <div className="space-y-1.5">
        <label className={labelCls}>아이브로 (헤드라인 위 작은 라벨)</label>
        <input value={form.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder={CTA_DEFAULTS.eyebrow} className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>헤드라인</label>
        <input value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder={CTA_DEFAULTS.headline} className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>부가 설명</label>
        <textarea
          value={form.subtext}
          onChange={(e) => set('subtext', e.target.value)}
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelCls}>기본 버튼 텍스트</label>
          <input value={form.btn1_text} onChange={(e) => set('btn1_text', e.target.value)} placeholder={CTA_DEFAULTS.btn1_text} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>기본 버튼 링크</label>
          <input value={form.btn1_href} onChange={(e) => set('btn1_href', e.target.value)} placeholder={CTA_DEFAULTS.btn1_href} className={inputCls} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelCls}>보조 버튼 텍스트</label>
          <input value={form.btn2_text} onChange={(e) => set('btn2_text', e.target.value)} placeholder={CTA_DEFAULTS.btn2_text} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>보조 버튼 링크</label>
          <input value={form.btn2_href} onChange={(e) => set('btn2_href', e.target.value)} placeholder={CTA_DEFAULTS.btn2_href} className={inputCls} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>각주 (버튼 아래 작은 텍스트)</label>
        <input value={form.footnote} onChange={(e) => set('footnote', e.target.value)} placeholder={CTA_DEFAULTS.footnote} className={inputCls} />
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2.5 pt-2">
        {/* 저장 성공 시에만 홈(/)을 새 탭으로 — 기존 저장 버튼 동작은 그대로(버튼 추가일 뿐) */}
        <SaveAndViewButton
          url="/"
          label="CTA 저장"
          disabled={isPending}
          onPendingChange={setViewSaving}
          onSave={async () => {
            const res = await onSave(form)
            if (res.status === 'ok') setSaved(true)
            return res
          }}
        />
        <button
          onClick={handleSave}
          disabled={isPending || viewSaving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-mark hover:brightness-95 text-white font-semibold text-sm px-5 py-3 sm:py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          CTA 저장
        </button>
      </div>
    </div>
  )
}
