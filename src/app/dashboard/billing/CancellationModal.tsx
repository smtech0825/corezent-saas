'use client'

/**
 * @컴포넌트: CancellationModal (+ 취소 사유·에러 매핑 유틸)
 * @설명: 구독 취소 이탈 사유 설문 모달. 통합 결제 표(BillingTable)에서 사용한다.
 *        상태·fetch는 부모가 관리하고, 이 파일은 표시(모달)와 사유 상수·에러 메시지 매핑만 담당한다.
 */

import { X, Loader2 } from 'lucide-react'

// ─── 취소 사유 옵션 ───────────────────────────────────────────────────────────

export const CANCEL_REASONS = [
  '가격이 너무 비쌉니다.',
  '필요한 기능이 부족합니다.',
  '사용하기가 너무 어렵습니다.',
  '단기 프로젝트에만 필요했습니다.',
  '더 나은 대안을 찾았습니다.',
  '기타 / 답변하지 않음.',
] as const

export type CancelReason = typeof CANCEL_REASONS[number]
export const OTHER_REASON: CancelReason = '기타 / 답변하지 않음.'

/** 취소 대상 구독(표시용 최소 정보) */
export interface CancelTarget {
  id: string
  productName: string
  currentPeriodEnd: string | null
}

/**
 * @함수명: cancelErrorMessage
 * @설명: 서버가 반환한 실패 code를 사용자용 한국어 메시지로 매핑한다(사유별 구분).
 */
export function cancelErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'ALREADY_CANCELLED':
      return '이미 취소 예약된 구독입니다. 페이지를 새로고침해 주세요.'
    case 'NOT_ACTIVE':
      return '이미 종료되었거나 취소할 수 없는 구독입니다.'
    case 'NOT_FOUND':
      return '구독 정보를 찾을 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.'
    case 'LS_API_ERROR':
      return '결제사에서 구독을 취소하지 못했습니다. 잠시 후 다시 시도하거나 고객센터로 문의해 주세요.'
    default:
      return '구독 취소에 실패했습니다. 다시 시도하거나 고객센터에 문의해 주세요.'
  }
}

interface ModalProps {
  target: CancelTarget
  selectedReason: CancelReason | ''
  onSelectReason: (r: CancelReason) => void
  otherText: string
  onOtherText: (t: string) => void
  cancelling: boolean
  onKeep: () => void
  onConfirm: () => void
}

export default function CancellationModal({
  target, selectedReason, onSelectReason, otherText, onOtherText,
  cancelling, onKeep, onConfirm,
}: ModalProps) {
  const fmtDate = target.currentPeriodEnd
    ? new Date(target.currentPeriodEnd).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const canSubmit = !!selectedReason && !cancelling

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onKeep} />

      <div className="relative z-10 w-full max-w-md bg-paper-raised border border-rule rounded-2xl shadow-2xl p-6">
        <button onClick={onKeep} className="absolute top-4 right-4 text-ink-faint hover:text-ink transition-colors" disabled={cancelling}>
          <X size={16} />
        </button>

        <div className="mb-5">
          <h2 className="text-lg font-bold text-ink">떠나신다니 아쉽습니다.</h2>
          <p className="text-sm text-ink-soft mt-1.5">취소하시는 이유를 알려주시겠어요?</p>
          {fmtDate && (
            <p className="text-xs text-ink-faint mt-2 bg-paper border border-rule rounded-lg px-3 py-2">
              구독은 <span className="text-mark font-medium">{fmtDate}</span>까지 유지됩니다.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 mb-6">
          {CANCEL_REASONS.map((reason) => (
            <label
              key={reason}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                selectedReason === reason ? 'border-mark/40 bg-mark/5' : 'border-rule hover:border-mark/40'
              }`}
            >
              <input
                type="radio"
                name="cancel-reason"
                value={reason}
                checked={selectedReason === reason}
                onChange={() => onSelectReason(reason)}
                className="mt-0.5 accent-mark shrink-0"
              />
              <span className="text-sm text-ink-soft leading-snug">{reason}</span>
            </label>
          ))}

          {selectedReason === OTHER_REASON && (
            <textarea
              value={otherText}
              onChange={(e) => onOtherText(e.target.value)}
              placeholder="(선택) 자세한 내용을 알려주세요"
              rows={3}
              className="w-full mt-1 bg-paper border border-rule rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark transition-colors resize-none"
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onKeep}
            disabled={cancelling}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-mark text-white hover:brightness-95 transition-colors disabled:opacity-50"
          >
            구독 유지하기
          </button>
          <button
            onClick={onConfirm}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-danger/30 text-danger hover:border-danger/60 hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {cancelling && <Loader2 size={14} className="animate-spin" />}
            구독 취소하기
          </button>
        </div>
      </div>
    </div>
  )
}
