'use client'

/**
 * @컴포넌트: BankTransferModal
 * @설명: 계좌이체(무통장 입금) 구매 모달 — ①입금 계좌 안내(은행·계좌번호·예금주·금액) ②본인 이름 송금 안내
 *        ③구독 자동갱신 불가 안내(구독형만) ④가입 이메일 입력·일치 검증 후 완료.
 *        완료 시 /api/orders/bank-transfer로 주문 생성 → 대시보드 결제 페이지로 이동.
 *        ⚠️ 이메일은 프리필하지 않는다(사용자가 직접 입력해 본인 확인 의미를 갖게 함).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Landmark, AlertTriangle } from 'lucide-react'
import { formatPrice } from '@/lib/price'

interface Props {
  onClose: () => void
  bank: string
  accountNumber: string
  accountHolder: string
  amountWon: number
  productName: string
  optionLabel: string
  isSubscription: boolean
  productPriceId: string
  quantity: number
  sessionEmail: string
  registeredName: string
}

/** 라벨 + 값 한 줄(계좌 안내용) */
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-ink-faint shrink-0">{label}</span>
      <span className={`text-sm text-ink font-medium text-right break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export default function BankTransferModal({
  onClose, bank, accountNumber, accountHolder, amountWon,
  productName, optionLabel, isSubscription, productPriceId, quantity, sessionEmail, registeredName,
}: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const trimmed = email.trim().toLowerCase()
  const emailMatches = !!sessionEmail && trimmed === sessionEmail.trim().toLowerCase()
  const showMismatch = email.trim().length > 0 && !emailMatches
  const canSubmit = emailMatches && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setErr('')
    try {
      const res = await fetch('/api/orders/bank-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productPriceId, quantity, depositorEmail: email.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setErr(data.error ?? '주문 생성에 실패했습니다. 다시 시도해 주세요.')
        setSubmitting(false)
        return
      }
      // 성공 → 대시보드 결제 페이지(입금 대기 배지 + 안내 재확인)
      router.push('/dashboard/billing')
    } catch {
      setErr('네트워크 오류입니다. 잠시 후 다시 시도해 주세요.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />

      {/* 모달 카드 */}
      <div className="relative z-10 w-full max-w-md bg-paper-raised border border-rule rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-rule sticky top-0 bg-paper-raised">
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-pen" />
            <h2 className="text-base font-bold text-ink">계좌이체로 구매</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-ink-faint hover:text-ink transition-colors disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 상품 요약 */}
          <div className="text-sm text-ink-soft">
            <span className="text-ink font-medium">{productName}</span>
            {optionLabel && <span className="text-mark"> · {optionLabel}</span>}
            {quantity > 1 && <span className="text-ink-faint"> · {quantity}개</span>}
          </div>

          {/* ① 입금 계좌 안내 */}
          <div className="border border-rule rounded-xl bg-paper px-4 py-3">
            <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1">입금 계좌</p>
            <InfoRow label="은행" value={bank || '-'} />
            <InfoRow label="계좌번호" value={accountNumber || '-'} mono />
            <InfoRow label="예금주" value={accountHolder || '-'} />
            <div className="border-t border-rule mt-1.5 pt-2 flex items-center justify-between">
              <span className="text-xs text-ink-faint">입금 금액</span>
              <span className="text-lg font-bold text-pen tabular-nums">{formatPrice(amountWon)}</span>
            </div>
          </div>

          {/* ② 본인 이름 송금 안내(필수 문구) */}
          <div className="border border-caution/30 bg-caution-soft rounded-xl px-4 py-3">
            <p className="text-xs text-ink-soft leading-relaxed">
              반드시 <b className="text-ink">가입하신 본인 이름으로</b> 송금해 주세요. 가입 이메일과 입금자 이름으로
              구매자를 확인하므로, 이름이 다르면 확인이 지연될 수 있습니다.
            </p>
            {registeredName && (
              <p className="text-xs text-ink mt-2">
                가입 이름: <b className="text-pen">{registeredName}</b>
              </p>
            )}
          </div>

          {/* ③ 구독 자동갱신 불가 안내(구독형만) */}
          {isSubscription && (
            <div className="flex items-start gap-2 text-xs text-ink-soft bg-paper border border-rule rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-caution shrink-0 mt-0.5" />
              <span>계좌이체는 자동 갱신되지 않습니다. 선택한 기간의 1회 결제이며, 기간 종료 후 재구매가 필요합니다.</span>
            </div>
          )}

          {/* ④ 가입 이메일 입력 + 일치 검증 */}
          <div>
            <label className="block text-xs text-ink-faint mb-1.5">가입 이메일 확인</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="가입 시 사용한 이메일"
              autoComplete="off"
              className={`w-full bg-paper border rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none transition-colors ${
                showMismatch ? 'border-danger focus:border-danger' : 'border-rule focus:border-mark'
              }`}
            />
            {showMismatch && (
              <p className="text-xs text-danger mt-1.5">가입 시 사용한 이메일을 입력해 주세요.</p>
            )}
          </div>

          {err && <p className="text-xs text-danger">{err}</p>}

          {/* 완료 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-md text-sm font-semibold bg-pen text-white hover:bg-pen-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            입금 대기 주문 완료
          </button>
          <p className="text-[11px] text-ink-faint text-center -mt-2">
            완료 후 3일 이내 입금해 주세요. 대시보드 · 결제에서 안내를 다시 확인할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
