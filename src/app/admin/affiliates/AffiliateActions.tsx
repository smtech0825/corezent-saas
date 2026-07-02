'use client'

/**
 * @컴포넌트: AffiliateActions
 * @설명: 제휴 관리 인터랙션 버튼 모음 — 관리자 전용.
 *        ConvertButton(커미션→크레딧 전환), IssueDiscountForm(크레딧→LS 할인 발급),
 *        ResolveButton(검토 플래그 해제). 결과 메시지를 인라인 표시.
 */

import { useState, useTransition } from 'react'
import { Loader2, ArrowRightLeft, Ticket, Check } from 'lucide-react'
import {
  convertCommissionsAction,
  issueCreditDiscountAction,
  resolveReviewAction,
} from './actions'

/** 추천인 전환 가능 커미션을 크레딧으로 전환 */
export function ConvertButton({ referrerId }: { referrerId: string }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => start(async () => {
          try { const r = await convertCommissionsAction(referrerId); setMsg({ ok: r.ok, text: r.message }) }
          catch { setMsg({ ok: false, text: '처리 실패 (030 적용·권한 확인)' }) }
        })}
        disabled={pending}
        className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 disabled:opacity-60 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
        전환
      </button>
      {msg && <span className={`text-[11px] ${msg.ok ? 'text-emerald-400' : 'text-red-400'} text-right max-w-[200px]`}>{msg.text}</span>}
    </div>
  )
}

/** 사용자 크레딧을 1회용 LS 할인으로 발급(차감 포함) */
export function IssueDiscountForm({ userId }: { userId: string }) {
  const [amount, setAmount] = useState('')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function submit() {
    const cents = Math.round(parseFloat(amount || '0') * 100)
    if (!Number.isInteger(cents) || cents <= 0) {
      setMsg({ ok: false, text: '금액을 입력하세요.' })
      return
    }
    start(async () => {
      try {
        const r = await issueCreditDiscountAction(userId, cents)
        setMsg({ ok: r.ok, text: r.message })
        if (r.ok) setAmount('')
      } catch {
        setMsg({ ok: false, text: '처리 실패 (030 적용·권한 확인)' })
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[#94A3B8]">$</span>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-20 bg-[#0B1120] border border-[#1E293B] text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500/50"
        />
        <button
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 bg-[#1E293B] hover:bg-[#1E293B]/70 disabled:opacity-60 text-[#E2E8F0] hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Ticket size={12} />}
          할인 발급
        </button>
      </div>
      {msg && <span className={`text-[11px] ${msg.ok ? 'text-emerald-400' : 'text-red-400'} text-right max-w-[260px]`}>{msg.text}</span>}
    </div>
  )
}

/** 검토 플래그 해제 */
export function ResolveButton({ commissionId }: { commissionId: string }) {
  const [pending, start] = useTransition()
  const [done, setDone] = useState(false)

  return (
    <button
      onClick={() => start(async () => {
        try { const r = await resolveReviewAction(commissionId); if (r.ok) setDone(true) }
        catch { /* 030 미적용/권한 오류 — 버튼 상태 유지 */ }
      })}
      disabled={pending || done}
      className="inline-flex items-center gap-1.5 bg-[#1E293B] hover:bg-[#1E293B]/70 disabled:opacity-60 text-[#E2E8F0] hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
    >
      {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      {done ? '해제됨' : '검토 완료'}
    </button>
  )
}
