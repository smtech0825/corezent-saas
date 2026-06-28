/**
 * @파일: lib/price.ts
 * @설명: 가격 표시 공용 포맷 — 사이트 화면에 노출되는 "상품/요금제 가격"을 KRW로 표기.
 *        통화 기호(₩)·로케일·천단위 콤마·"VAT 포함" 문구를 이 한 곳에서만 처리한다.
 *        ⚠️ 매출(orders.amount, 정수 cents)·제휴 크레딧(*_cents) 경로에는 사용 금지.
 *           이 함수의 입력은 "원화 정수"(예: 9900)이며 ÷100 환산을 하지 않는다.
 */

/** KRW는 zero-decimal 통화 — 소수점 없이 천단위 콤마만. (예: 9900 → ₩9,900) */
const KRW_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

/** 값이 없거나 숫자가 아닐 때 보여줄 안전한 기본 표시 */
const EMPTY_DISPLAY = '—'

/** VAT 포함 안내 문구 — 화면마다 박지 않고 이 한 곳에서만 관리 */
const VAT_SUFFIX = ' (VAT 포함)'

/**
 * @함수명: formatPrice
 * @설명: 원화 정수 가격을 사용자 표시용 문자열로 포맷합니다. (예: 9900 → "₩9,900")
 * @매개변수: value - 원화 정수 가격(소수가 들어와도 반올림하여 정수 처리). null/undefined/NaN이면 빈 표시.
 * @매개변수: opts.vat - true이면 " (VAT 포함)" 문구를 덧붙임.
 * @반환값: "₩9,900" 또는 "₩9,900 (VAT 포함)", 값이 유효하지 않으면 "—"
 */
export function formatPrice(
  value: number | null | undefined,
  opts?: { vat?: boolean },
): string {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) {
    return EMPTY_DISPLAY
  }
  // KRW는 정수 단위 — 혹시 소수가 들어와도 환산이 아니라 표시 반올림만 한다.
  const formatted = KRW_FORMATTER.format(Math.round(value))
  return opts?.vat ? `${formatted}${VAT_SUFFIX}` : formatted
}
