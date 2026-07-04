'use client'

/**
 * @컴포넌트: BillingTable
 * @설명: 구독 + 결제 내역을 하나로 합친 통합 결제 표.
 *        열: 제품(옵션) | 구입일시 | 금액 | 결제수단 | 상태 | 관리(라이선스 확인·구독 취소).
 *        각 행은 주문 1건이며, 구독이 연결된 주문은 갱신일·구독 취소 버튼을 관리 열에 표시한다.
 *        데스크톱(md+)은 표, 모바일(<md)은 카드 폴백. 취소는 이탈 사유 모달(CancellationModal) 경유.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Package, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/common/Toast'
import { deriveSubStatus } from '@/lib/subscription-status'
import { formatKRW } from '@/lib/money'
import { formatDateTimeKR, formatDateKR } from '@/lib/datetime'
import CancellationModal, {
  cancelErrorMessage, OTHER_REASON, type CancelReason, type CancelTarget,
} from './CancellationModal'

export interface SubInfo {
  id: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  billingInterval: string | null
  lsSubscriptionId: string | null
}

export interface BillingRow {
  orderId: string
  productName: string
  optionLabel: string | null
  createdAt: string
  amount: number            // cents
  paymentMethod: string     // 'card' | 'bank_transfer'
  orderStatus: string
  subscription: SubInfo | null
}

interface Props {
  rows: BillingRow[]
}

// ─── 상태 매핑(주문 + 구독 통합) ─────────────────────────────────────────────

type Badge = { label: string; cls: string }
const NEUTRAL = 'text-ink-soft bg-paper-shade border-rule'

function payLabel(method: string): string {
  return method === 'bank_transfer' ? '계좌이체' : '신용카드'
}

/**
 * @함수명: rowStatus
 * @설명: 주문·구독 상태를 통합 표시 배지로 정규화한다. 주문 종결상태(환불·입금대기) 우선 →
 *        구독이 있으면 파생 상태(활성/취소 예약/일시정지/해지/만료) → 아니면 주문 상태.
 */
function rowStatus(row: BillingRow, optimisticallyCancelled: boolean): Badge {
  if (row.orderStatus === 'refunded') return { label: '환불됨', cls: 'text-info bg-info-soft border-info/20' }
  if (row.orderStatus === 'pending_deposit') return { label: '입금 대기', cls: 'text-caution bg-caution-soft border-caution/20' }

  if (row.subscription) {
    const d = deriveSubStatus({
      status: row.subscription.status,
      cancel_at_period_end: optimisticallyCancelled ? true : row.subscription.cancelAtPeriodEnd,
      current_period_end: row.subscription.currentPeriodEnd,
    })
    const map: Record<string, Badge> = {
      active:     { label: '활성',      cls: 'text-ok bg-ok-soft border-ok/20' },
      cancelling: { label: '취소 예약', cls: 'text-caution bg-caution-soft border-caution/20' },
      paused:     { label: '일시정지', cls: 'text-caution bg-caution-soft border-caution/20' },
      cancelled:  { label: '해지',      cls: NEUTRAL },
      expired:    { label: '만료',      cls: NEUTRAL },
    }
    return map[d] ?? map.cancelled
  }

  if (row.orderStatus === 'cancelled') return { label: '취소됨', cls: NEUTRAL }
  if (row.orderStatus === 'pending') return { label: '대기 중', cls: 'text-caution bg-caution-soft border-caution/20' }
  if (row.orderStatus === 'paid') {
    return row.amount <= 0
      ? { label: '무료', cls: 'text-info bg-info-soft border-info/20' }
      : { label: '결제 완료', cls: 'text-ok bg-ok-soft border-ok/20' }
  }
  return { label: row.orderStatus, cls: NEUTRAL }
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

export default function BillingTable({ rows }: Props) {
  const { showToast } = useToast()
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set())

  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [selectedReason, setSelectedReason] = useState<CancelReason | ''>('')
  const [otherText, setOtherText] = useState('')
  const [cancelling, setCancelling] = useState(false)

  function openCancelModal(sub: SubInfo, productName: string) {
    setCancelTarget({ id: sub.id, productName, currentPeriodEnd: sub.currentPeriodEnd })
    setSelectedReason('')
    setOtherText('')
  }
  function closeCancelModal() {
    if (cancelling) return
    setCancelTarget(null)
    setSelectedReason('')
    setOtherText('')
  }

  async function handleConfirmCancel() {
    if (!cancelTarget || !selectedReason) return
    setCancelling(true)
    const reason = selectedReason === OTHER_REASON && otherText.trim()
      ? `${OTHER_REASON} — ${otherText.trim()}`
      : selectedReason
    try {
      let res: Response
      try {
        res = await fetch('/api/subscriptions/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId: cancelTarget.id, reason }),
        })
      } catch {
        showToast('error', '네트워크 오류로 구독을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string }
      if (!res.ok) {
        console.error('[cancel]', res.status, data.code, data.error)
        showToast('error', cancelErrorMessage(data.code))
        return
      }
      setCancelledIds((prev) => new Set([...prev, cancelTarget.id]))
      showToast('success', '구독이 취소되었습니다. 결제 기간이 끝날 때까지 서비스를 계속 이용하실 수 있습니다.')
      closeCancelModal()
    } finally {
      setCancelling(false)
    }
  }

  // 제품 | 구입일시 | 금액 | 결제수단 | 상태 | 관리
  const gridCols = 'grid-cols-[minmax(0,1.4fr)_160px_110px_92px_96px_minmax(0,1.5fr)]'

  return (
    <>
      {/* 데스크톱(md+): 통합 표 — 좁으면 가로 스크롤 */}
      <div className="hidden md:block bg-paper-raised border border-rule rounded-xl overflow-x-auto">
        <div className="min-w-[860px]">
          <div className={`grid ${gridCols} gap-4 px-5 py-3 border-b border-rule text-xs text-ink-faint font-medium`}>
            <span>제품</span>
            <span>구입일시</span>
            <span>금액</span>
            <span>결제수단</span>
            <span>상태</span>
            <span>관리</span>
          </div>
          {rows.map((row) => {
            const optimistic = cancelledIds.has(row.subscription?.id ?? '')
            const badge = rowStatus(row, optimistic)
            const sub = row.subscription
            const isPureActive = sub
              ? deriveSubStatus({ status: sub.status, cancel_at_period_end: optimistic ? true : sub.cancelAtPeriodEnd, current_period_end: sub.currentPeriodEnd }) === 'active'
              : false
            return (
              <div key={row.orderId} className={`grid ${gridCols} gap-4 items-center px-5 py-3 border-b border-rule last:border-0 hover:bg-paper-shade transition-colors`}>
                {/* 제품 + 옵션 */}
                <div className="flex items-center gap-2 min-w-0">
                  <Package size={14} className="text-mark shrink-0" />
                  <span className="text-sm text-ink truncate">{row.productName}</span>
                  {row.optionLabel && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-mark/10 text-mark border border-mark/30 shrink-0 truncate">{row.optionLabel}</span>
                  )}
                </div>
                {/* 구입일시 */}
                <span className="text-xs text-ink-soft tabular-nums">{formatDateTimeKR(row.createdAt)}</span>
                {/* 금액 */}
                <span className="text-sm text-ink font-medium tabular-nums">{formatKRW(row.amount)}</span>
                {/* 결제수단 */}
                <span className="text-xs text-ink-soft">{payLabel(row.paymentMethod)}</span>
                {/* 상태 */}
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium text-center ${badge.cls}`}>{badge.label}</span>
                {/* 관리 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href="/dashboard/licenses" className="inline-flex items-center gap-1.5 text-xs text-mark hover:text-ink border border-mark/40 hover:border-mark/60 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                    <ExternalLink size={11} /> 라이선스
                  </Link>
                  {sub && (
                    <span className="text-xs text-ink-faint whitespace-nowrap">갱신 {formatDateKR(sub.currentPeriodEnd)}</span>
                  )}
                  {sub && isPureActive && (
                    <button onClick={() => openCancelModal(sub, row.productName)} className="inline-flex items-center text-xs text-danger border border-danger/20 hover:border-danger/40 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                      구독 취소
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 모바일(<md): 카드 폴백 */}
      <div className="md:hidden flex flex-col gap-3">
        {rows.map((row) => {
          const optimistic = cancelledIds.has(row.subscription?.id ?? '')
          const badge = rowStatus(row, optimistic)
          const sub = row.subscription
          const isPureActive = sub
            ? deriveSubStatus({ status: sub.status, cancel_at_period_end: optimistic ? true : sub.cancelAtPeriodEnd, current_period_end: sub.currentPeriodEnd }) === 'active'
            : false
          return (
            <div key={row.orderId} className="bg-paper-raised border border-rule rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Package size={15} className="text-mark shrink-0" />
                    <span className="text-sm text-ink font-medium truncate">{row.productName}</span>
                  </div>
                  {row.optionLabel && <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-mark/10 text-mark border border-mark/30">{row.optionLabel}</span>}
                  <p className="text-xs text-ink-faint mt-1.5">{formatDateTimeKR(row.createdAt)} · {payLabel(row.paymentMethod)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-ink font-medium">{formatKRW(row.amount)}</p>
                  <span className={`inline-block mt-1 text-xs px-2.5 py-1 rounded-full border font-medium ${badge.cls}`}>{badge.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-rule">
                <Link href="/dashboard/licenses" className="inline-flex items-center gap-1.5 text-xs text-mark border border-mark/40 px-3 py-1.5 rounded-lg">
                  <ExternalLink size={11} /> 라이선스 확인
                </Link>
                {sub && <span className="text-xs text-ink-faint">갱신 {formatDateKR(sub.currentPeriodEnd)}</span>}
                {sub && isPureActive && (
                  <button onClick={() => openCancelModal(sub, row.productName)} className="inline-flex items-center text-xs text-danger border border-danger/20 px-3 py-1.5 rounded-lg">
                    구독 취소
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 취소 사유 모달 */}
      {cancelTarget && (
        <CancellationModal
          target={cancelTarget}
          selectedReason={selectedReason}
          onSelectReason={setSelectedReason}
          otherText={otherText}
          onOtherText={setOtherText}
          cancelling={cancelling}
          onKeep={closeCancelModal}
          onConfirm={handleConfirmCancel}
        />
      )}
    </>
  )
}
