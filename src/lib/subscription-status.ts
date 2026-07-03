/**
 * @파일: lib/subscription-status.ts
 * @설명: 구독 상태의 표시·집계 단일 출처(Source of Truth).
 *        raw status(active/paused/cancelled/expired) + cancel_at_period_end + 기간(current_period_end)을
 *        하나의 '파생 상태'로 정규화한다. 대시보드 개요·결제 페이지가 모두 이 함수를 사용해
 *        "활성"의 정의와 집계를 일치시킨다.
 *
 *        파생 상태:
 *          - 'active'     : 정상 활성(갱신 예정)
 *          - 'cancelling' : 취소 예약 — 접근은 기간 종료까지 유지되나 갱신되지 않음
 *                           (사용자가 취소했거나 LS가 이미 cancelled로 바꿨으나 기간이 남음)
 *          - 'paused'     : 일시정지
 *          - 'cancelled'  : 취소·기간 종료
 *          - 'expired'    : 만료
 */

export type SubDisplayStatus = 'active' | 'cancelling' | 'paused' | 'cancelled' | 'expired'

/** 파생 상태 계산의 입력(대시보드 조회가 select하는 최소 컬럼) */
export interface SubStatusInput {
  status: string | null | undefined
  cancel_at_period_end?: boolean | null
  current_period_end?: string | null
}

/**
 * @함수명: deriveSubStatus
 * @설명: 구독의 표시/집계용 파생 상태를 계산한다(단일 출처).
 * @매개변수: sub - status·cancel_at_period_end·current_period_end 를 가진 구독 부분 객체
 * @매개변수: nowMs - 기준 시각(ms). 기본 현재. 테스트·서버 렌더에서 주입 가능
 * @반환값: SubDisplayStatus
 */
export function deriveSubStatus(sub: SubStatusInput, nowMs: number = Date.now()): SubDisplayStatus {
  const status = String(sub.status ?? '')
  const periodEndMs = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null
  const withinPeriod = periodEndMs == null || periodEndMs > nowMs

  if (status === 'expired') return 'expired'
  if (status === 'paused') return 'paused'

  // 취소 예약: 취소가 예약됐거나(active+cancel_at_period_end) LS가 이미 cancelled로 바꿨지만
  // 결제 기간이 남아 접근이 유지되는 상태.
  if ((sub.cancel_at_period_end === true || status === 'cancelled') && withinPeriod) {
    return 'cancelling'
  }

  if (status === 'cancelled') return 'cancelled' // 기간 종료
  return 'active'
}

/**
 * @함수명: isActiveSub
 * @설명: 집계상 '활성 구독'(현재 접근 권한을 부여하는 구독)인지 판정한다.
 *        활성 = 파생 상태가 'active' 또는 'cancelling'(기간 종료 전 취소 예약도 접근 유지).
 * @매개변수: sub - 구독 부분 객체
 * @반환값: 활성이면 true
 */
export function isActiveSub(sub: SubStatusInput, nowMs: number = Date.now()): boolean {
  const d = deriveSubStatus(sub, nowMs)
  return d === 'active' || d === 'cancelling'
}
