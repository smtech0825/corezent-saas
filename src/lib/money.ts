/**
 * @파일: lib/money.ts
 * @설명: 주문·매출·크레딧 금액의 "저장 단위 ↔ 화면 표시" 단일 출처.
 *
 *        ★ 저장 규약: 금액은 그 통화의 **최소단위 정수**로 저장한다.
 *          · 소수 자릿수 0인 통화(KRW 등) → 최소단위 = 1원   (9900 = ₩9,900)
 *          · 소수 자릿수 2인 통화(USD 등) → 최소단위 = 1센트 (699  = $6.99)
 *          자릿수는 통화 코드로 Intl 표준에서 구한다 — 통화 목록을 코드에 손으로 적지 않는다.
 *
 *        ⚠️ 통화를 모르면 원화라고 가정하지 않는다. 코드가 비었거나 표준에서 못 찾으면
 *           소수 2자리로 처리하고 그 사실을 서버 기록에 남긴다(조용히 넘어가지 않는다).
 *
 *        (product_prices.price(=원 정수, 예 9900)의 표시는 lib/price.ts 담당 —
 *         이 파일은 orders.amount·크레딧처럼 "최소단위로 저장된 값" 전용이다.)
 */

/** 통화를 확정하지 못했을 때 쓸 소수 자릿수 — 큰 금액을 작게 보이게 하는 쪽으로 틀리지 않도록 2를 쓴다 */
const FALLBACK_FRACTION_DIGITS = 2

/**
 * 결제사(LemonSqueezy)가 쓰는 소수 자릿수 — 통화와 상관없이 항상 2자리(cents)다.
 * 근거(실측): 정가 9,900원짜리 옵션(product_prices c3ee312f…)의 원화 실주문이
 * amount=990114(=9,901.14원, 환율 환산 잔돈 포함)로 들어왔다.
 * → 원화처럼 소수가 없는 통화도 결제사는 100을 곱해 보낸다.
 * 그래서 결제사 값은 저장 전에 반드시 fromProviderAmount로 우리 규약(ISO 최소단위)에 맞춘다.
 */
const PROVIDER_FRACTION_DIGITS = 2

/** 값이 없거나 숫자가 아닐 때 보여줄 안전한 기본 표시 */
const EMPTY_DISPLAY = '—'

/** 통화 코드 → 소수 자릿수 캐시 (Intl 인스턴스 생성 비용을 매 호출마다 치르지 않기 위함) */
const fractionDigitsCache = new Map<string, number>()

/** 이미 경고를 남긴 통화 코드 — 목록 렌더처럼 같은 값이 수십 번 지나가도 기록은 한 번만 */
const warnedCurrencies = new Set<string>()

/**
 * @함수명: normalizeCurrency
 * @설명: 통화 코드를 비교·조회용으로 다듬습니다(공백 제거 + 대문자).
 * @매개변수: currency - 원본 통화 코드
 * @반환값: 다듬은 코드(없으면 빈 문자열)
 */
function normalizeCurrency(currency: string | null | undefined): string {
  return (currency ?? '').trim().toUpperCase()
}

/**
 * @함수명: currencyFractionDigits
 * @설명: 통화 코드의 소수 자릿수를 Intl 표준에서 구합니다. (KRW → 0, USD → 2)
 *        표준에서 구하지 못하면 기본값으로 처리하고 그 사실을 서버 기록에 남깁니다.
 * @매개변수: currency - ISO 4217 통화 코드
 * @반환값: 소수 자릿수(구하지 못하면 FALLBACK_FRACTION_DIGITS)
 */
export function currencyFractionDigits(currency: string | null | undefined): number {
  const code = normalizeCurrency(currency)

  if (!code) {
    if (!warnedCurrencies.has('')) {
      warnedCurrencies.add('')
      console.warn(`[money] 통화 코드가 비어 있어 소수 ${FALLBACK_FRACTION_DIGITS}자리로 처리합니다.`)
    }
    return FALLBACK_FRACTION_DIGITS
  }

  const cached = fractionDigitsCache.get(code)
  if (cached !== undefined) return cached

  let digits = FALLBACK_FRACTION_DIGITS
  try {
    digits =
      new Intl.NumberFormat('en-US', { style: 'currency', currency: code })
        .resolvedOptions().maximumFractionDigits ?? FALLBACK_FRACTION_DIGITS
  } catch {
    if (!warnedCurrencies.has(code)) {
      warnedCurrencies.add(code)
      console.warn(
        `[money] 통화 코드 '${code}'를 표준에서 찾지 못해 소수 ${FALLBACK_FRACTION_DIGITS}자리로 처리합니다.`,
      )
    }
  }

  fractionDigitsCache.set(code, digits)
  return digits
}

/**
 * @함수명: toMinorUnits
 * @설명: 통화의 기본 단위 금액(예: 원)을 저장용 최소단위 정수로 바꿉니다.
 *        KRW처럼 소수 자릿수가 0이면 그대로, USD처럼 2면 ×100.
 * @매개변수: major - 기본 단위 금액 / currency - 통화 코드
 * @반환값: 최소단위 정수
 */
export function toMinorUnits(major: number, currency: string | null | undefined): number {
  const digits = currencyFractionDigits(currency)
  return Math.round(major * 10 ** digits)
}

/**
 * @함수명: fromProviderAmount
 * @설명: 결제사가 보낸 금액(항상 2자리 cents)을 우리 저장 규약(그 통화의 최소단위)으로 바꿉니다.
 *        원화 990000 → 9900 / 달러 699 → 699.
 *        ⚠️ 결제사 값을 orders.amount에 넣기 전에 반드시 이 함수를 거칩니다.
 *           원본값은 orders.provider_raw_amount(마이그레이션 067)에 가공 없이 따로 남깁니다.
 * @매개변수: providerAmount - 결제사가 보낸 금액 / currency - 통화 코드
 * @반환값: 그 통화의 최소단위 정수
 */
export function fromProviderAmount(
  providerAmount: number,
  currency: string | null | undefined,
): number {
  const n = Number(providerAmount)
  if (!Number.isFinite(n)) return 0
  const digits = currencyFractionDigits(currency)
  return Math.round((n / 10 ** PROVIDER_FRACTION_DIGITS) * 10 ** digits)
}

/**
 * @함수명: toProviderAmount
 * @설명: 우리 저장 규약(통화 최소단위) 금액을 결제사가 받는 단위(2자리 cents)로 되돌립니다.
 *        결제사 API에 금액을 보낼 때(할인 발급 등) 씁니다. fromProviderAmount의 역함수입니다.
 * @매개변수: minor - 통화 최소단위 정수 / currency - 통화 코드
 * @반환값: 결제사 단위 정수
 */
export function toProviderAmount(minor: number, currency: string | null | undefined): number {
  const n = Number(minor)
  if (!Number.isFinite(n)) return 0
  const digits = currencyFractionDigits(currency)
  return Math.round((n / 10 ** digits) * 10 ** PROVIDER_FRACTION_DIGITS)
}

/**
 * @함수명: formatMoney
 * @설명: 최소단위로 저장된 금액을 그 통화의 표기로 포맷합니다.
 *        (990000·'KRW' → "₩990,000" / 699·'USD' → "$6.99")
 * @매개변수: minor - 최소단위 정수 금액(없거나 숫자가 아니면 "—") / currency - 통화 코드
 * @반환값: 통화 기호가 붙은 문자열. 기호를 붙일 수 없으면 숫자 + 코드
 */
export function formatMoney(
  minor: number | null | undefined,
  currency: string | null | undefined,
): string {
  const n = Number(minor)
  if (minor == null || !Number.isFinite(n)) return EMPTY_DISPLAY

  const code = normalizeCurrency(currency)
  const digits = currencyFractionDigits(code)
  const major = n / 10 ** digits

  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(major)
  } catch {
    // 통화 기호를 붙일 수 없는 경우(코드 없음·비표준 코드)에도 값 자체는 감추지 않는다.
    const number = new Intl.NumberFormat('ko-KR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(major)
    return code ? `${number} ${code}` : number
  }
}

/**
 * @함수명: formatMoneyCompact
 * @설명: 차트 축·막대처럼 자리가 좁은 곳에 쓰는 축약 표기(만·억 단위)입니다.
 *        formatMoney와 같은 환산 규칙을 쓰되 통화 기호 없이 숫자만 줄여 씁니다
 *        (정확한 값은 축 눈금·툴팁의 formatMoney가 보여줍니다).
 * @매개변수: minor - 최소단위 정수 금액 / currency - 통화 코드
 * @반환값: "123만" 형태의 축약 문자열
 */
export function formatMoneyCompact(
  minor: number | null | undefined,
  currency: string | null | undefined,
): string {
  const n = Number(minor)
  if (minor == null || !Number.isFinite(n)) return EMPTY_DISPLAY
  const major = n / 10 ** currencyFractionDigits(currency)
  return new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Math.round(major),
  )
}

/**
 * @함수명: sumMinorByCurrency
 * @설명: 통화가 섞일 수 있는 목록의 합계를 통화별로 나눠 더합니다.
 *        서로 다른 통화를 한 숫자로 합치면 그 값은 아무 뜻도 없으므로 합치지 않습니다.
 * @매개변수: rows - amount(최소단위)·currency를 가진 행 목록
 * @반환값: 통화 코드 → 합계(최소단위) 맵. 입력이 비면 빈 맵
 */
export function sumMinorByCurrency(
  rows: Array<{ amount: number | null | undefined; currency: string | null | undefined }>,
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const value = Number(row.amount)
    if (!Number.isFinite(value)) continue
    const code = normalizeCurrency(row.currency)
    totals.set(code, (totals.get(code) ?? 0) + value)
  }
  return totals
}

/**
 * @함수명: formatMoneyTotals
 * @설명: 통화별 합계 맵을 화면 문자열로 만듭니다. 통화가 둘 이상이면 가운뎃점으로 나란히 적어
 *        "합쳐진 하나의 숫자"라는 오해가 생기지 않게 합니다.
 * @매개변수: totals - sumMinorByCurrency 결과
 * @반환값: "₩9,900" 또는 "₩9,900 · $6.99", 비어 있으면 "—"
 */
export function formatMoneyTotals(totals: Map<string, number>): string {
  if (totals.size === 0) return EMPTY_DISPLAY
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, amount]) => formatMoney(amount, code))
    .join(' · ')
}

/**
 * @함수명: sumAndFormat
 * @설명: 목록을 통화별로 합산해 바로 표시 문자열로 만듭니다(위 두 함수의 조합 단축형).
 * @매개변수: rows - amount(최소단위)·currency를 가진 행 목록
 * @반환값: 표시 문자열
 */
export function sumAndFormat(
  rows: Array<{ amount: number | null | undefined; currency: string | null | undefined }>,
): string {
  return formatMoneyTotals(sumMinorByCurrency(rows))
}
