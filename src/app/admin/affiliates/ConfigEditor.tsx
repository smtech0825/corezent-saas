'use client'

/**
 * @컴포넌트: ConfigEditor
 * @설명: affiliate_program_config 편집 폼 — 관리자 전용.
 *        모든 규칙값(커미션·보류/쿠키 일수·캡·최소전환·통화·자기추천·반복)을 DB에 저장.
 *        금액(min_payout_credit)은 화면에선 원(₩) 단위로 입력받아 cents(원×100)로 변환해 저장.
 */

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { updateAffiliateConfigAction } from './actions'
import type { AffiliateConfigInput } from './types'

const INPUT_CLS = 'w-full bg-paper border border-rule text-ink text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-mark'

interface Props {
  initial: AffiliateConfigInput
  /** min_payout_credit 초기값 — 원(₩) 단위 문자열로 표시 */
  minPayoutWon: string
}

export default function ConfigEditor({ initial, minPayoutWon }: Props) {
  const [v, setV] = useState<AffiliateConfigInput>(initial)
  const [minWon, setMinWon] = useState(minPayoutWon)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function set<K extends keyof AffiliateConfigInput>(key: K, value: AffiliateConfigInput[K]) {
    setV((prev) => ({ ...prev, [key]: value }))
  }

  function save() {
    setMsg(null)
    startTransition(async () => {
      // 원(₩) 입력 → cents(원×100) 정수 변환
      const cents = Math.max(0, Math.round(parseFloat(minWon || '0') * 100))
      const res = await updateAffiliateConfigAction({ ...v, min_payout_credit: cents })
      setMsg({ ok: res.ok, text: res.message })
    })
  }

  return (
    <div className="border border-rule bg-paper-raised rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-rule">
        <h2 className="text-sm font-semibold text-ink">프로그램 설정</h2>
        <p className="text-xs text-ink-faint mt-0.5">모든 적립 규칙의 단일 출처입니다. 변경은 이후 결제부터 적용됩니다.</p>
      </div>

      <div className="p-6 space-y-4">
        {/* 토글들 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Toggle label="프로그램 활성" checked={v.program_enabled} onChange={(b) => set('program_enabled', b)} />
          <Toggle label="갱신 반복 적립" checked={v.is_recurring} onChange={(b) => set('is_recurring', b)} />
          <Toggle label="자기추천 차단" checked={v.self_referral_blocked} onChange={(b) => set('self_referral_blocked', b)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="커미션 유형">
            <select value={v.commission_type} onChange={(e) => set('commission_type', e.target.value)} className={INPUT_CLS}>
              <option value="percent">percent (%)</option>
              <option value="flat">flat (고정 cents)</option>
            </select>
          </Field>
          <Field label={v.commission_type === 'flat' ? '커미션 값 (cents)' : '커미션 값 (%)'}>
            <input type="number" value={v.commission_value} onChange={(e) => set('commission_value', Number(e.target.value))} className={INPUT_CLS} />
          </Field>
          <Field label="반복 적립 개월 캡">
            <input type="number" value={v.recurring_months_cap} onChange={(e) => set('recurring_months_cap', Number(e.target.value))} className={INPUT_CLS} />
          </Field>
          <Field label="쿠키 귀속 일수">
            <input type="number" value={v.cookie_days} onChange={(e) => set('cookie_days', Number(e.target.value))} className={INPUT_CLS} />
          </Field>
          <Field label="보류(hold) 일수">
            <input type="number" value={v.hold_days} onChange={(e) => set('hold_days', Number(e.target.value))} className={INPUT_CLS} />
          </Field>
          <Field label="최소 전환 금액 (원)">
            <input type="number" step="1" min="0" value={minWon} onChange={(e) => setMinWon(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="통화">
            <input value={v.currency} onChange={(e) => set('currency', e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>

        {msg && (
          <p className={`text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</p>
        )}
      </div>

      <div className="px-6 pb-5">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 bg-mark hover:brightness-95 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {pending ? '저장 중…' : '설정 저장'}
        </button>
      </div>
    </div>
  )
}

/** 레이블 + 입력 래퍼 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-ink-soft mb-1.5">{label}</label>
      {children}
    </div>
  )
}

/** on/off 토글 스위치 */
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors ${
        checked ? 'bg-mark/10 border-mark/30 text-mark' : 'bg-paper border-rule text-ink-soft'
      }`}
    >
      <span>{label}</span>
      <span className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-mark' : 'bg-paper-shade'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}
