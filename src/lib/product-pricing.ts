/**
 * @파일: lib/product-pricing.ts
 * @설명: 상품 대표가(최저 옵션가) 계산 공용 유틸 — 서버·클라이언트 공용(순수 함수).
 *        랜딩(app/page.tsx)·/pricing·/product가 "이 상품의 최저 옵션가"를 같은 규칙으로
 *        계산하게 해, 고가 티어(예: ₩39,000)가 대표가로 노출되는 문제를 방지한다.
 *        (기존엔 각 페이지가 Array.find로 '첫 행'을 대표가로 써서 최저가가 아니었다.)
 */

export interface PriceRowLike {
  type: string
  interval?: string | null
  price: number
  checkout_url?: string | null
  is_active?: boolean
}

/**
 * @함수명: lowestPriceRow
 * @설명: predicate를 만족하는 행 중 가격이 가장 낮은 행을 반환한다(대표가 선택의 단일 규칙).
 * @매개변수: rows - 가격 행 배열, predicate - 필터 조건(기본: 전체)
 * @반환값: 최저가 행, 조건 만족 행이 없으면 undefined
 */
export function lowestPriceRow<T extends { price: number }>(
  rows: T[],
  predicate: (r: T) => boolean = () => true,
): T | undefined {
  let best: T | undefined
  for (const r of rows) {
    if (!predicate(r)) continue
    if (!Number.isFinite(r.price)) continue
    if (best === undefined || r.price < best.price) best = r
  }
  return best
}

export interface RepresentativePrice {
  amount: number | null // 최저 대표가(원). 유효 행 없으면 null
  isFrom: boolean        // 서로 다른 가격의 구매 옵션이 2개 이상이라 '부터' 표기가 필요한지
  suffix: string         // '/월' | '/년' | '' — 최저가 행 기준
}

/**
 * @함수명: getRepresentativePrice
 * @설명: 상품 활성 가격 행에서 대표가(최저가) + '부터' 여부 + 접미사를 계산한다.
 *        '부터'는 서로 다른 가격이 2개 이상일 때 true(옵션/티어가 여럿이라 "…부터"로 표기).
 * @매개변수: rows - 가격 행 배열(is_active로 걸러 넘기거나 그대로 넘겨도 됨)
 * @반환값: { amount, isFrom, suffix }
 */
export function getRepresentativePrice(rows: PriceRowLike[]): RepresentativePrice {
  const active = rows.filter(
    (r) => (r.is_active ?? true) && Number.isFinite(r.price) && r.price > 0,
  )
  if (active.length === 0) return { amount: null, isFrom: false, suffix: '' }
  const lowest = lowestPriceRow(active)!
  const suffix = lowest.type === 'one_time' ? '' : lowest.interval === 'annual' ? '/년' : '/월'
  const distinctPrices = new Set(active.map((r) => r.price)).size
  return { amount: lowest.price, isFrom: distinctPrices > 1, suffix }
}
