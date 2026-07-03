'use client'

/**
 * @컴포넌트: OrderActions
 * @설명: 관리자 주문 상세의 환불/구독취소 액션 버튼 + 확인 모달.
 *        환불은 실제 돈이 나가므로 금액 표시 + "환불" 문구 재확인을 요구한다.
 *        이미 환불/취소된 대상은 버튼 비활성. 실패는 모달에 그대로 표면화(조용한 실패 금지).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertTriangle, RotateCcw, XCircle } from 'lucide-react'
import { refundOrder, cancelSubscriptionForOrder } from './actions'

const REFUND_WORD = '환불'

interface Props {
  orderId: string
  orderStatus: string
  hasLsOrderId: boolean
  amountLabel: string
  canCancelSub: boolean
}

type ModalKind = 'refund' | 'cancel' | null

export default function OrderActions({ orderId, orderStatus, hasLsOrderId, amountLabel, canCancelSub }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalKind>(null)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const alreadyRefunded = orderStatus === 'refunded'

  function open(kind: ModalKind) {
    setConfirmText('')
    setError('')
    setModal(kind)
  }
  function close() {
    if (loading) return
    setModal(null)
  }

  async function run() {
    setLoading(true)
    setError('')
    try {
      const res = modal === 'refund' ? await refundOrder(orderId) : await cancelSubscriptionForOrder(orderId)
      if (res.ok) {
        setModal(null)
        router.refresh()
        return
      }
      setError(res.error)
    } catch {
      setError('처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const refundConfirmDisabled = loading || confirmText.trim() !== REFUND_WORD

  return (
    <section className="border border-rule bg-paper-raised rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-ink mb-1.5">주문 처리</h2>
      <p className="text-xs text-ink-faint mb-4">환불·구독 취소는 실제 결제/구독에 반영됩니다. 신중히 진행하세요.</p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => open('refund')}
          disabled={alreadyRefunded || !hasLsOrderId}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-danger border border-danger/30 hover:border-danger/60 hover:bg-danger-soft px-4 py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RotateCcw size={14} />
          {alreadyRefunded ? '환불됨' : '전액 환불'}
        </button>

        {canCancelSub && (
          <button
            type="button"
            onClick={() => open('cancel')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-caution border border-caution/30 hover:border-caution/60 hover:bg-caution-soft px-4 py-2 rounded-lg transition-colors"
          >
            <XCircle size={14} />
            구독 취소
          </button>
        )}
      </div>

      {!hasLsOrderId && !alreadyRefunded && (
        <p className="text-xs text-ink-faint mt-3">이 주문은 Lemon Squeezy order_id가 없어 API 환불이 불가합니다.</p>
      )}

      {/* 확인 모달 */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={close} />
          <div className="relative z-10 w-full max-w-md bg-paper-raised border border-rule rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-danger" />
              <h3 className="text-lg font-bold text-ink">
                {modal === 'refund' ? '전액 환불하시겠어요?' : '구독을 취소하시겠어요?'}
              </h3>
            </div>

            {modal === 'refund' ? (
              <>
                <p className="text-sm text-ink-soft mb-2">
                  주문 <span className="font-mono text-xs text-ink">#{orderId.slice(0, 8).toUpperCase()}</span> 을(를){' '}
                  <span className="text-ink font-semibold">{amountLabel}</span> 전액 환불합니다. 되돌릴 수 없습니다.
                </p>
                <p className="text-sm text-ink-soft mb-4">
                  계속하려면 <span className="font-semibold text-ink">&lsquo;{REFUND_WORD}&rsquo;</span> 을(를) 입력하세요.
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={REFUND_WORD}
                  className="w-full bg-paper border border-rule rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-danger/60 transition-colors mb-3"
                />
              </>
            ) : (
              <p className="text-sm text-ink-soft mb-4">
                이 주문의 구독을 취소합니다. 결제 기간이 끝날 때까지는 이용 가능하며, 이후 갱신되지 않습니다.
              </p>
            )}

            {error && <p className="text-sm text-danger mb-3">{error}</p>}

            <div className="flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-mark text-white hover:brightness-95 transition-colors disabled:opacity-50"
              >
                취소하지 않기
              </button>
              <button
                type="button"
                onClick={run}
                disabled={modal === 'refund' ? refundConfirmDisabled : loading}
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-danger/30 text-danger hover:border-danger/60 hover:bg-danger-soft transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {modal === 'refund' ? '전액 환불하기' : '구독 취소하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
