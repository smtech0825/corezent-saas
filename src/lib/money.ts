/**
 * @파일: lib/money.ts
 * @설명: 주문·매출 금액(orders.amount) 표시용 KRW 포맷터 — 단일 출처.
 *        ★ orders.amount 는 "센트 단위"다. LS는 KRW도 센트(×100)로 저장한다.
 *          (검증 2026-06-30: 실주문 amount=990114·currency=KRW → ₩9,901.14, LS 표시와 일치 → 표시 ₩9,901.)
 *        formatKRW 가 ÷100 하여 원 단위로 환산·표기한다.
 *        합계도 "센트로 합산한 값"을 그대로 formatKRW에 넘긴다(÷100은 formatKRW에서 한 번만).
 *        (product_prices(=원 정수, 예 4900) 표시는 lib/price.ts 담당 — 이 파일은 매출/주문 amount 전용.)
 */

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

/**
 * @함수명: formatKRW
 * @설명: 주문/매출 금액(센트)을 ₩ 문자열로 포맷합니다. (예: 990114 → "₩9,901")
 * @매개변수: cents - 센트 단위 금액(없거나 숫자가 아니면 "—")
 * @반환값: "₩9,901" 또는 "—"
 * @비고: 합계 표시도 "센트로 합산한 값"을 그대로 넘기면 된다(÷100은 여기서 한 번만 수행).
 */
export function formatKRW(cents: number | null | undefined): string {
  const n = Number(cents)
  if (cents == null || !Number.isFinite(n)) return '—'
  return KRW_FORMATTER.format(Math.round(n / 100))
}
