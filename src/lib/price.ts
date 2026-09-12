/**
 * @파일: lib/price.ts
 * @설명: 가격 표시 공용 포맷 — 사이트 화면에 노출되는 "상품/요금제 가격"을 KRW로 표기.
 *        로케일·천단위 콤마·"VAT 포함" 문구를 이 한 곳에서만 처리한다.
 *        ⚠️ 매출(orders.amount, 정수 cents)·제휴 크레딧(*_cents) 경로에는 사용 금지.
 *           이 함수의 입력은 "원화 정수"(예: 9900)이며 ÷100 환산을 하지 않는다.
 *
 *        ★ 표기 규칙(원화는 '원', 소수점 없음)은 여기서 따로 정하지 않고
 *          lib/money.ts의 formatMoney에 맡긴다 — 주문·제휴 화면과 같은 규칙을 쓰기 위함.
 *          원화는 최소단위가 곧 1원이라 이 파일의 입력값을 그대로 넘기면 된다.
 *          (다른 통화 표기는 formatMoney가 그대로 담당하며 이 파일은 관여하지 않는다)
 */

import { DEFAULT_CURRENCY, formatMoney } from './money'

/** 값이 없거나 숫자가 아닐 때 보여줄 안전한 기본 표시 */
const EMPTY_DISPLAY = '—'

/** VAT 포함 안내 문구 — 화면마다 박지 않고 이 한 곳에서만 관리 */
const VAT_SUFFIX = ' (VAT 포함)'

/**
 * @함수명: formatPrice
 * @설명: 원화 정수 가격을 사용자 표시용 문자열로 포맷합니다. (예: 9900 → "9,900원")
 * @매개변수: value - 원화 정수 가격(소수가 들어와도 반올림하여 정수 처리). null/undefined/NaN이면 빈 표시.
 * @매개변수: opts.vat - true이면 " (VAT 포함)" 문구를 덧붙임.
 * @반환값: "9,900원" 또는 "9,900원 (VAT 포함)", 값이 유효하지 않으면 "—"
 */
export function formatPrice(
  value: number | null | undefined,
  opts?: { vat?: boolean },
): string {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) {
    return EMPTY_DISPLAY
  }
  // KRW는 정수 단위 — 혹시 소수가 들어와도 환산이 아니라 표시 반올림만 한다.
  const formatted = formatMoney(Math.round(value), DEFAULT_CURRENCY)
  return opts?.vat ? `${formatted}${VAT_SUFFIX}` : formatted
}
