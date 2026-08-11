/**
 * @파일: lib/tax/engine-types.ts
 * @설명: 세금 계산 엔진의 입력·결과·오류 타입과 rule_value(jsonb) 스키마 타입.
 *        ⚠️ 세율·공제액·과세표준 구간 등 실제 숫자는 이 파일에 절대 넣지 않는다.
 *        여기에는 '구조(스키마)'만 정의하고, 값은 전부 DB(tax_rules)에서 읽는다.
 */

import type { Json, TaxRuleMode, TaxRuleStatus } from './types'

// ─── 계산기 입력 ──────────────────────────────────────────────────────────────

/** 취득 원인 — sale(유상매매) / gift(증여) */
export type AcquisitionCause = 'sale' | 'gift'

/** 증여자와의 관계 — spouse(배우자) / lineal(직계존비속) / other(그 외) */
export type DonorRelation = 'spouse' | 'lineal' | 'other'

/**
 * @타입: AcquisitionInput
 * @설명: 취득세 계산 입력. 개인식별정보(이름·이메일·IP)는 포함하지 않는다.
 */
export interface AcquisitionInput {
  baseDate: string           // 취득일 = 계산 기준일 (YYYY-MM-DD)
  regionCode: string         // 소재지 행정구역 코드 (tax_regulated_areas.region_code와 대조)
  cause: AcquisitionCause
  price: number              // 취득가액 (원). 증여면 실제 지급대가 — 순수 증여는 0
  houseCountAfter: number    // 취득 후 1세대 주택 수
  areaOver85: boolean        // 전용면적 85제곱미터 초과 여부
  // 고급 입력 (기본 접힘)
  firstHome?: boolean            // 생애최초 취득 여부
  temporaryTwoHome?: boolean     // 일시적 2주택 여부
  donorRelation?: DonorRelation  // 증여 시 — 증여자와의 관계
  marketValue?: number           // 증여 시 — 시가인정액 (원)
  officialPrice?: number         // 증여 시 — 공시가격 (원)
  donorIsSingleHomeOwner?: boolean // 증여 시 — 증여자 1주택자 여부 (중과 배제 판단)
}

// ─── 계산 결과 ────────────────────────────────────────────────────────────────

/**
 * @타입: AppliedRuleInfo
 * @설명: 계산에 사용된 룰의 근거 정보 — 결과 화면이 이걸 그대로 보여준다.
 */
export interface AppliedRuleInfo {
  id: string
  ruleKey: string
  lawName: string             // 근거 법령명
  lawArticle: string          // 근거 조문
  lawUrl: string              // 법제처 원문 링크
  effectiveFrom: string       // 시행일
  effectiveTo: string | null
  status: TaxRuleStatus       // confirmed(확정) / proposed(개정안)
}

/** 세액 분해 — 반드시 항목별로 따로 담는다. 합계만 반환하지 않는다 */
export interface AcquisitionBreakdown {
  acquisitionTax: number      // 취득세 본세
  localEducationTax: number   // 지방교육세
  ruralSpecialTax: number     // 농어촌특별세
  total: number
}

/**
 * @타입: AcquisitionSuccess
 * @설명: 취득세 계산 성공 결과. 세액 분해 + 적용 룰 근거 목록.
 */
export interface AcquisitionSuccess {
  ok: true
  causeApplied: 'onerous' | 'gift'  // 최종 적용된 취득 유형 (간주 결과 반영)
  deemedGift: boolean               // 대가 지급 거래가 무상취득으로 간주됐는지
  taxBase: number                   // 과세표준 (원)
  isRegulatedArea: boolean          // 조정대상지역 여부 (기준일 판정 결과)
  breakdown: AcquisitionBreakdown
  appliedRules: AppliedRuleInfo[]
  ruleMode: TaxRuleMode
  containsProposedRule: boolean     // 개정안(proposed) 룰이 하나라도 쓰였는지 — 경고 배지용
}

// ─── 오류 ─────────────────────────────────────────────────────────────────────

/**
 * @타입: TaxEngineErrorCode
 * @설명: 엔진 오류 코드. 룰이 없으면 0원으로 계산하지 않고 RULE_NOT_REGISTERED를 반환한다.
 */
export type TaxEngineErrorCode =
  | 'INVALID_INPUT'        // 입력값 오류
  | 'RULE_NOT_REGISTERED'  // 해당 시점의 룰 미등록 — 절대 0원으로 대체하지 않는다
  | 'RULE_CONFLICT'        // 같은 rule_key에 유효 룰이 2건 이상 — 계산 중단
  | 'RULE_VALUE_INVALID'   // rule_value 구조가 스키마와 다름 (관리자 입력 오류)
  | 'NO_MATCHING_RATE_ROW' // 세율표에 입력 조건에 맞는 행이 없음
  | 'AMBIGUOUS_RATE_ROW'   // 세율표에서 우선순위로도 행이 하나로 정해지지 않음
  | 'DB_ERROR'             // DB 조회 실패

/** 엔진 실패 결과 — message는 화면에 그대로 보여줄 한국어 문장 */
export interface TaxEngineFailure {
  ok: false
  code: TaxEngineErrorCode
  message: string
  ruleKey?: string
}

export type AcquisitionResult = AcquisitionSuccess | TaxEngineFailure

// ─── rule_value(jsonb) 스키마 ─────────────────────────────────────────────────
// 관리자가 tax_rules.rule_value에 입력하는 JSON의 구조. 값(숫자)은 관리자가 넣는다.

/**
 * @타입: RateSpec
 * @설명: 세율 명세.
 *        fixed          — 세율 고정: 세액 = 과세표준 × ratePercent/100
 *        linear_by_base — 과세표준 비례 사잇값 공식:
 *                         세율% = slopePercent × (과세표준/per) + interceptPercent
 *                         (min/maxPercent로 상·하한 고정 가능. 계수는 관리자가 법령 산식대로 입력)
 */
export type RateSpec =
  | { type: 'fixed'; ratePercent: number }
  | {
      type: 'linear_by_base'
      per: number              // 과세표준 나눔 단위 (원)
      slopePercent: number
      interceptPercent: number
      minPercent?: number
      maxPercent?: number
    }

/** 조건 명세 — eq(일치) / min·max(숫자 범위, 경계 포함) / in(목록 포함) */
export interface ConditionSpec {
  eq?: Json
  min?: number
  max?: number
  in?: Json[]
}

/** 조건 집합 — 필드명은 엔진이 제공하는 판정 컨텍스트의 키만 쓸 수 있다 */
export type Conditions = Record<string, ConditionSpec>

/**
 * @타입: RateTableRow
 * @설명: 세율표 한 행. when 조건에 전부 맞으면 후보가 되고, 여러 행이 맞으면
 *        priority가 가장 높은 행이 적용된다(동률이면 오류). credit은 세액 감면(원).
 */
export interface RateTableRow {
  when: Conditions
  priority?: number
  rates: {
    acquisition: RateSpec       // 취득세 본세
    local_education: RateSpec   // 지방교육세
    rural_special: RateSpec     // 농어촌특별세
  }
  credit?: {
    target: 'acquisition' | 'local_education' | 'rural_special'
    amount: number              // 감면액 (원) — 관리자 입력
  }
}

/** rule_value: 세율표 (acquisition.onerous.rates / acquisition.gift.rates) */
export interface RateTableValue {
  rows: RateTableRow[]
}

/** rule_value: 증여 과세표준 기준 (acquisition.gift.tax_base) */
export interface GiftTaxBaseValue {
  base: 'market_value' | 'official_price'  // 시가인정액 / 공시가격
}

/** rule_value: 증여 중과 (acquisition.gift.heavy) — 공시가격 기준액 + 중과 세율표 */
export interface GiftHeavyValue {
  officialPriceMin: number  // 중과가 적용되는 공시가격 하한 (원) — 관리자 입력
  rows: RateTableRow[]
}

/**
 * @타입: DeemedGiftThresholdValue
 * @설명: 무상취득 간주 기준 (acquisition.gift.deemed_gift_threshold).
 *        차액 = 시가인정액 − 실제 지급대가.
 *        mode=any: 기준 중 하나만 넘어도 간주 / all: 전부 넘어야 간주.
 */
export interface DeemedGiftThresholdValue {
  mode: 'any' | 'all'
  minDiffAmount?: number        // 차액 기준 금액 (원)
  minDiffRatioPercent?: number  // 차액 기준 비율 (시가인정액 대비 %)
}

/** rule_value: 단수 처리 (acquisition.rounding) — 미등록 시 1원 단위 버림 */
export interface RoundingValue {
  unit: number                     // 절사 단위 (원)
  method: 'floor' | 'round' | 'ceil'
}
