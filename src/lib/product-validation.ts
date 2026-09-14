/**
 * @파일: lib/product-validation.ts
 * @설명: 상품 옵션(가격) 행 저장 전 검증 — 클라이언트 폼·서버 액션 공용(순수 함수).
 *        "어긋난 조합이 검증 없이 저장·노출되는" 것을 차단한다.
 *        검증 대상은 실제로 저장되는 행(가격이 입력된 행)뿐이다.
 */

/** 검증에 필요한 옵션 행 최소 형태 (ProductForm PriceEntry의 부분집합) */
export interface OptionRowInput {
  price: string
  license_tier: string
  lemon_squeezy_variant_id: string
  checkout_url: string
  option_axis1_label: string
  option_axis2_label: string
}

import { TIER_OPTIONS, isValidTierChoice } from '@/lib/license-tiers'

/** 오류 문구에 보여 줄 선택지 — 목록 자체는 lib/license-tiers.ts 한 곳에서만 정의한다 */
const TIER_CHOICE_TEXT = TIER_OPTIONS.map((t) => t.label).join(' / ')

/**
 * @함수명: validateOptionRows
 * @설명: 저장될 옵션 행들을 검증한다. 문제가 있으면 사용자용 한국어 메시지(어느 행인지 포함)를,
 *        없으면 null을 반환한다. 클라이언트(폼)·서버(액션) 양쪽에서 호출한다.
 *        규칙: ① 가격>0 ② tier는 비었거나 유효값 ③ variant_id는 비었거나 숫자
 *              ④ 같은 상품 내 (축1,축2) 조합 중복 금지 ⑤ variant_id 중복 금지
 *              ⑥ checkout_url 중복 금지(옵션마다 서로 다른 URL) — 어떤 행과 중복인지 표시
 * @매개변수: rows - 옵션 행 배열(가격 미입력 행은 저장되지 않으므로 검증 제외)
 * @반환값: 위반 메시지 또는 null
 */
export function validateOptionRows(rows: OptionRowInput[]): string | null {
  const saveable = rows.filter((r) => r.price.trim() !== '')
  if (saveable.length === 0) return '가격이 입력된 옵션 행이 최소 1개 필요합니다.'

  const comboSeen = new Map<string, number>()
  const variantSeen = new Map<string, number>()
  const urlSeen = new Map<string, number>()

  for (let i = 0; i < saveable.length; i++) {
    const r = saveable[i]
    const no = i + 1

    // ① 가격 > 0
    const price = parseFloat(r.price)
    if (!Number.isFinite(price) || price <= 0) {
      return `옵션 ${no}행: 가격은 0보다 큰 숫자여야 합니다.`
    }

    // ② tier — 반드시 목록에서 고른 값이어야 한다. 빈 값도 막는다.
    //    빈 채로 저장되면 결제는 성사되는데 웹훅이 등급을 못 정해 라이선스가 발급되지 않는다.
    //    라이선스 개념이 없는 상품은 "해당 없음"(none)을 고른다 — 빈 값과 구별해야
    //    "아직 안 정함(실수)"과 "정했고 없음(의도)"이 갈린다.
    const tier = r.license_tier.trim().toLowerCase()
    if (!tier) {
      return `옵션 ${no}행: 라이선스 등급을 골라 주세요. 라이선스가 없는 상품이면 "해당 없음"을 고르세요.`
    }
    if (!isValidTierChoice(tier)) {
      return `옵션 ${no}행: 라이선스 등급 "${r.license_tier}"는 고를 수 없는 값입니다. (${TIER_CHOICE_TEXT})`
    }

    // ③ variant_id — 비었으면 허용, 있으면 숫자 문자열
    const variant = r.lemon_squeezy_variant_id.trim()
    if (variant && !/^\d+$/.test(variant)) {
      return `옵션 ${no}행: Lemon Squeezy Variant ID는 숫자만 입력하세요.`
    }

    // ④ (축1,축2) 조합 중복 금지
    const combo = `${r.option_axis1_label.trim()}|${r.option_axis2_label.trim()}`
    if (comboSeen.has(combo)) {
      const a1 = r.option_axis1_label.trim() || '-'
      const a2 = r.option_axis2_label.trim() || '-'
      return `옵션 ${no}행: 옵션 조합(${a1} · ${a2})이 ${comboSeen.get(combo)}행과 중복됩니다.`
    }
    comboSeen.set(combo, no)

    // ⑤ variant_id 중복 금지
    if (variant) {
      if (variantSeen.has(variant)) {
        return `옵션 ${no}행: Variant ID(${variant})가 ${variantSeen.get(variant)}행과 중복됩니다.`
      }
      variantSeen.set(variant, no)
    }

    // ⑥ checkout_url 중복 금지 — 옵션마다 서로 다른 URL이어야 함(이중 입력이 어긋나는 것 차단)
    const url = r.checkout_url.trim()
    if (url) {
      if (urlSeen.has(url)) {
        return `옵션 ${no}행: Checkout URL이 ${urlSeen.get(url)}행과 중복됩니다. 옵션마다 서로 다른 결제 URL이어야 합니다.`
      }
      urlSeen.set(url, no)
    }
  }

  return null
}
