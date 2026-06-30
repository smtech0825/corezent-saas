/**
 * @파일: lib/money.ts
 * @설명: 주문·매출 금액(orders.amount 등) 표시용 KRW 포맷터 — 단일 출처.
 *        결제가 KRW로 전환됨 → DB/사이트 모두 ₩로 표기한다.
 *        orders.amount 를 "원화 정수"로 취급한다(LS의 zero-decimal 관례상 KRW는 ×100 하지 않음,
 *        product_prices.price=4900=₩4,900 와도 일치).
 *
 *   ⚠️ 단위 보정 단일 지점 — toWon():
 *      만약 첫 KRW 실주문 검증에서 LS가 금액을 ×100(예: ₩4,900 → 490000)으로 보낸다면,
 *      toWon() 한 줄만 `Math.round(value / 100)` 로 바꾸면 전 화면(주문·매출·대시보드)이 동시에 정상화된다.
 *      (product_prices 표시는 lib/price.ts 가 담당 — 이 파일은 매출/주문 금액 전용.)
 */

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

/** orders.amount(원화 정수 가정) → 표시용 원 단위 정수. ★단위 보정 시 이 한 줄만 변경. */
function toWon(value: number): number {
  return Math.round(value)
}

/**
 * @함수명: formatKRW
 * @설명: 주문/매출 금액을 ₩ 문자열로 포맷합니다. (예: 4900 → "₩4,900")
 * @매개변수: value - 원화 정수 금액(없거나 숫자가 아니면 "—")
 * @반환값: "₩4,900" 또는 "—"
 */
export function formatKRW(value: number | null | undefined): string {
  const n = Number(value)
  if (value == null || !Number.isFinite(n)) return '—'
  return KRW_FORMATTER.format(toWon(n))
}

/**
 * @함수명: toWonAmount
 * @설명: 합산용 — 금액을 원 단위 정수로 환산(보정 포함). 매출 합계 등에서 사용.
 * @매개변수: value - 원화 정수 금액(없거나 숫자가 아니면 0)
 * @반환값: 원 단위 정수
 */
export function toWonAmount(value: number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? toWon(n) : 0
}
