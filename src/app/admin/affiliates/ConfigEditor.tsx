'use client'

/**
 * @컴포넌트: ConfigEditor
 * @설명: affiliate_program_config 편집 폼 — 관리자 전용.
 *        모든 규칙값(커미션·보류/쿠키 일수·캡·최소전환·통화·자기추천·반복)을 DB에 저장.
 *        금액(min_payout_credit)은 화면에선 $ 단위로 입력받아 cents로 변환해 저장.
 */

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { updateAffiliateConfigAction } from './actions'
import type { AffiliateConfigInput } from './types'

const INPUT_CLS = 'w-full bg-[#0B1120] border border-[#1E293B] text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500/50'

interface Props {
  initial: AffiliateConfigInput
  /** min_payout_credit 초기값(cents) — $ 입력으로 표시 */
  minPayoutDollars: string
}

export default function ConfigEditor({ initial, minPayoutDollars }: Props) {
  const [v, setV] = useState<AffiliateConfigInput>(initial)
  const [minDollars, setMinDollars] = useState(minPayoutDollars)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function set<K extends keyof AffiliateConfigInput>(key: K, value: AffiliateConfigInput[K]) {
    setV((prev) => ({ ...prev, [key]: value }))
  }

  function save() {
    setMsg(null)
    startTransition(async () => {
      // $ 입력 → cents 정수 변환
      const cents = Math.max(0, Math.round(parseFloat(minDollars || '0') * 100))
      const res = await updateAffiliateConfigAction({ ...v, min_payout_credit: cents })
      setMsg({ ok: res.ok, text: res.message })
    })
  }

  return (
    <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1E293B]">
        <h2 className="text-sm font-semibold text-white">프로그램 설정</h2>
        <p className="text-xs text-[#94A3B8] mt-0.5">모든 적립 규칙의 단일 출처입니다. 변경은 이후 결제부터 적용됩니다.</p>
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
          <Field label="최소 전환 금액 ($)">
            <input type="number" step="0.01" value={minDollars} onChange={(e) => setMinDollars(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="통화">
            <input value={v.currency} onChange={(e) => set('currency', e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>

        {msg && (
          <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>
        )}
      </div>

      <div className="px-6 pb-5">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
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
      <label className="block text-sm text-[#E2E8F0] mb-1.5">{label}</label>
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
        checked ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-[#0B1120] border-[#1E293B] text-[#E2E8F0]'
      }`}
    >
      <span>{label}</span>
      <span className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-amber-500' : 'bg-[#1E293B]'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}
