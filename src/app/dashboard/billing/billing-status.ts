/**
 * @파일: dashboard/billing/billing-status.ts
 * @설명: 결제 표의 상태 표시 로직 — BillingTable에 있던 것을 그대로 옮긴 것
 *        (파일 300줄 상한 준수용 분리 — 로직 무변경). 순수 함수만 있어
 *        서버·클라이언트 어느 쪽에서도 안전하게 import할 수 있다.
 */

import { deriveSubStatus } from '@/lib/subscription-status'

export type Badge = { label: string; cls: string }

const NEUTRAL = 'text-ink-soft bg-paper-shade border-rule'

/**
 * @함수명: payLabel
 * @설명: 결제수단 값을 표시 라벨로 바꿉니다.
 * @매개변수: method - orders.payment_method 값
 * @반환값: '계좌이체' 또는 '신용카드'
 */
export function payLabel(method: string): string {
  return method === 'bank_transfer' ? '계좌이체' : '신용카드'
}

/**
 * @함수명: nextStepHint
 * @설명: 주문 상태에서 "다음에 무슨 일이 일어나는지"를 한 줄로 돌려준다.
 *        orders.status의 실제 값(pending·paid·refunded·cancelled·pending_deposit)만 쓰고
 *        새 상태를 만들지 않는다. 처리 시간은 확인된 안내 문구가 없어 언급하지 않는다.
 * @매개변수: orderStatus - orders.status 값
 * @반환값: 안내 문구. 설명이 필요 없는 상태(paid 등)는 null
 */
export function nextStepHint(orderStatus: string): string | null {
  switch (orderStatus) {
    case 'pending_deposit': return '입금이 확인되면 라이선스가 발급됩니다.'
    case 'pending':         return '결제 확인 후 라이선스가 발급됩니다.'
    case 'refunded':        return '환불 처리되어 라이선스가 회수되었습니다.'
    case 'cancelled':       return '취소된 주문입니다. 발급된 라이선스가 없습니다.'
    default:                return null   // paid — 별도 안내 불필요
  }
}

/** rowStatus가 필요로 하는 최소 행 형태(BillingRow와 구조 호환) */
export interface RowStatusInput {
  orderStatus: string
  amount: number
  subscription: {
    status: string
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
  } | null
}

/**
 * @함수명: rowStatus
 * @설명: 주문·구독 상태를 통합 표시 배지로 정규화한다. 주문 종결상태(환불·입금대기) 우선 →
 *        구독이 있으면 파생 상태(활성/취소 예약/일시정지/해지/만료) → 아니면 주문 상태.
 * @매개변수: row - 주문·구독 부분 행 / optimisticallyCancelled - 방금 취소한 행의 낙관적 표시
 * @반환값: { label, cls } 배지
 */
export function rowStatus(row: RowStatusInput, optimisticallyCancelled: boolean): Badge {
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
