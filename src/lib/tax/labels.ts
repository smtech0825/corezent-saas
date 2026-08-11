/**
 * @파일: lib/tax/labels.ts
 * @설명: 세금 모듈 공용 한국어 라벨·런타임 상수 목록.
 *        타입(types.ts)의 유니언과 반드시 일치해야 한다 — 관리자 화면의 select 옵션과
 *        서버 검증이 이 목록을 함께 쓴다.
 */

import type { RegulatedAreaType, TaxRuleStatus, TaxType } from './types'

/** 세목 목록 (DB CHECK 제약과 동일 순서) */
export const TAX_TYPES: TaxType[] = [
  'acquisition',
  'rental',
  'transfer',
  'property',
  'comprehensive',
  'inheritance',
]

/** 세목 한국어 라벨 */
export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  acquisition: '취득세',
  rental: '임대소득세',
  transfer: '양도소득세',
  property: '재산세',
  comprehensive: '종합부동산세',
  inheritance: '상속·증여세',
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
