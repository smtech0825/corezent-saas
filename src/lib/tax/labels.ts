/**
 * @파일: lib/tax/labels.ts
 * @설명: 세금 모듈 공용 한국어 라벨·런타임 상수 목록.
 *        타입(types.ts)의 유니언과 반드시 일치해야 한다 — 관리자 화면의 select 옵션과
 *        서버 검증이 이 목록을 함께 쓴다.
 */

import type { RegulatedAreaType, TaxRuleStatus, TaxRuleTaxType, TaxType } from './types'

/**
 * 규제지역 적용 세목 목록 — tax_regulated_areas.applies_to CHECK(6종 고정)와 동일.
 * ⚠️ 여기에 새 계산기 세목(stamp 등)을 추가하지 마라 — 규제지역 화면 체크박스와
 *    서버 검증이 이 배열을 쓰는데, applies_to CHECK에 없는 값은 저장이 거부된다.
 *    룰 편집용 전체 세목은 아래 RULE_TAX_TYPES가 담당한다.
 */
export const TAX_TYPES: TaxType[] = [
  'acquisition',
  'rental',
  'transfer',
  'property',
  'comprehensive',
  'inheritance',
]

/** 세목 한국어 라벨 (TaxType 전체 — 계산기 세목 포함) */
export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  acquisition: '취득세',
  rental: '임대소득세',
  transfer: '양도소득세',
  property: '재산세',
  comprehensive: '종합부동산세',
  inheritance: '상속·증여세',
  stamp: '인지세',
  brokerage: '중개수수료',
  jeonse_conversion: '전월세 전환',
  registration: '등기비용',
}

/** 계산기 세목 4종 (058) — 룰 편집에서만 쓰이고 규제지역과는 무관하다 */
export const CALCULATOR_TAX_TYPES: TaxType[] = ['stamp', 'brokerage', 'jeonse_conversion', 'registration']

/**
 * 룰 편집(tax_rules) 전용 세목 목록 — 세목 6종 + 'common'(전 세목 공통).
 * ⚠️ 규제지역 화면의 적용 세목 체크박스에는 쓰지 않는다(그쪽은 TAX_TYPES —
 *    tax_regulated_areas.applies_to CHECK에 'common'이 없다).
 */
export const RULE_TAX_TYPES: TaxRuleTaxType[] = [...TAX_TYPES, ...CALCULATOR_TAX_TYPES, 'common']

/** 룰 편집 전용 세목 한국어 라벨 */
export const RULE_TAX_TYPE_LABELS: Record<TaxRuleTaxType, string> = {
  ...TAX_TYPE_LABELS,
  common: '공통 (전 세목)',
}

/** 룰 상태 목록 */
export const RULE_STATUSES: TaxRuleStatus[] = ['confirmed', 'proposed', 'repealed']

/** 룰 상태 한국어 라벨 */
export const RULE_STATUS_LABELS: Record<TaxRuleStatus, string> = {
  confirmed: '확정',
  proposed: '개정안',
  repealed: '폐지',
}

/** 규제지역 구분 목록 */
export const AREA_TYPES: RegulatedAreaType[] = ['adjustment', 'speculation']

/** 규제지역 구분 한국어 라벨 */
export const AREA_TYPE_LABELS: Record<RegulatedAreaType, string> = {
  adjustment: '조정대상지역',
  speculation: '투기과열지구',
}
