/**
 * @파일: lib/tax/comprehensive-types.ts
 * @설명: 종합부동산세(주택분·인별) 엔진의 입력·결과·rule_value(jsonb) 스키마 타입.
 *        ⚠️ 세율·비율·공제액·구간·한도·날짜(과세기준일 월·일 포함) 등 실제 숫자는
 *        이 파일에 절대 넣지 않는다 — 구조(스키마)만 정의하고 값은 전부 DB(tax_rules)에서
 *        읽는다. 입력은 주택 목록(배열)이 아니라 '주택 수 + 공시가격 합계'다 —
 *        인별 합산 세목이라 채별 정보 없이 계산된다(입력을 늘리지 않는 대원칙).
 *        (공통 타입은 engine-types.ts, 상한 상태·과세기준일 값 타입은 property-types.ts를
 *        그대로 쓴다 — 같은 구조를 두 번 정의하지 않는다)
 */

import type { TaxRuleMode } from './types'
import type { AppliedRuleInfo, Conditions, RateSpec, TaxEngineFailure } from './engine-types'
import type { PropertyCapStatus } from './property-types'

// ─── rule_value 행 형태 ──────────────────────────────────────────────────────

/**
 * 세율표 행 — 일반/중과 구분은 관리자가 행에 heavy 표시로 적는다.
 * 조건(when)은 house_count·tax_base 등 판정 컨텍스트 필드를 쓴다 —
 * "주택 수와 과세표준에 따라 일반·중과 표로 갈린다"는 구조만 코드가 안다.
 */
export interface ComprehensiveRateRow {
  when: Conditions
  priority?: number
  rate: RateSpec
  heavy?: boolean       // true면 중과 세율표 행 — 결과에 '중과 적용'으로 표시된다
}

/** 세액공제 행 — 연령별·보유기간별 공제율(%). 값은 관리자 입력 */
export interface ComprehensiveCreditRow {
  when: Conditions
  priority?: number
  creditPercent: number
}

// ─── rule_value 스키마 (룰 키별) ─────────────────────────────────────────────

/** comprehensive.basic_deduction — 기본공제 (1세대 1주택 / 그 외) */
export interface ComprehensiveBasicDeductionValue {
  generalAmount: number     // 일반 기본공제 (원) — 관리자 입력
  oneHouseAmount: number    // 1세대 1주택 기본공제 (원) — 관리자 입력
}

/** comprehensive.rates — 세율표(일반/중과 행 혼합, heavy 표시로 구분) */
export interface ComprehensiveRatesValue {
  rows: ComprehensiveRateRow[]
}

/**
 * comprehensive.tax_credit — 1세대 1주택 연령별·보유기간별 세액공제.
 * 두 공제율을 합산하되 maxTotalPercent를 넘지 못한다(합산 한도).
 * 조건에 맞는 행이 없으면 그 축의 공제는 0(미매칭=공제 없음이 정상 의미).
 */
export interface ComprehensiveTaxCreditValue {
  ageRows: ComprehensiveCreditRow[]        // 조건: age (만 나이)
  holdingRows: ComprehensiveCreditRow[]    // 조건: holding_years (만 연수)
  maxTotalPercent: number                  // 합산 한도(%) — 관리자 입력
}

/**
 * comprehensive.burden_cap — 세부담 상한(주택 수 등 조건별 상한 비율).
 * 값 구조는 재산세 세부담 상한(property.burden_cap)과 동일해 검증기를 공유한다.
 * 상한액 = 직전 연도 총세액(재산세+종부세 상당액) × capPercent/100.
 */
// → property-types.ts의 PropertyBurdenCapValue·PropertyBurdenCapRow를 그대로 쓴다.

/** comprehensive.rural_surtax — 농어촌특별세(종부세액 비례). 비율은 관리자 입력 */
export interface ComprehensiveRuralSurtaxValue {
  ratePercent: number
}

// comprehensive.assessment_ratio — 재산세와 같은 { ratioPercent } 구조 (검증기 공유).
// comprehensive.assessment_date — 재산세와 같은 { month, day } 구조 (검증기 공유).
// comprehensive.rounding — 취득세·양도세와 같은 RoundingValue (engine-types.ts).

// ─── 계산기 입력 ──────────────────────────────────────────────────────────────

/** 보유 주택 수 — 3은 '3주택 이상' */
export type ComprehensiveHouseCount = 1 | 2 | 3

/**
 * @타입: ComprehensiveInput
 * @설명: 종합부동산세 계산 입력. 개인식별정보(이름·이메일·IP)는 포함하지 않는다.
 *        재산세 상당액 공제는 사용자에게 묻지 않고 재산세 엔진으로 자동 계산한다.
 *        직전 연도 총세액은 선택 — 비우면 세부담 상한을 적용하지 않고 그 사실을 담는다.
 */
export interface ComprehensiveInput {
  taxYear: number                       // 과세연도 (YYYY) — 과세기준일은 룰(월·일)과 조합
  houseCount: ComprehensiveHouseCount   // 인별 보유 주택 수
  totalOfficialPrice: number            // 공시가격 합계 (원, 인별 합산)
  isOneHouse: boolean                   // 1세대 1주택 여부 (단독명의) — 주택 수 1일 때만 가능
  age?: number                          // 1세대 1주택 — 만 나이 (연령 세액공제 판정)
  holdingYears?: number                 // 1세대 1주택 — 보유기간 (만 연수, 보유 세액공제 판정)
  prevTotalTax?: number                 // 직전 연도 총세액(재산세+종부세 상당액, 원) — 선택
}

// ─── 계산 결과 ────────────────────────────────────────────────────────────────

/** 세액 분해 — 반드시 항목별로 따로 담는다. 합계만 반환하지 않는다 */
export interface ComprehensiveBreakdown {
  rawTax: number              // 산출세액 (세율 적용 직후, 공제 전)
  propertyDeduction: number   // 재산세 상당액 공제 (재산세 엔진 자동 계산)
  taxCreditAmount: number     // 1세대 1주택 세액공제 합계 (한도 적용 후)
  comprehensiveTax: number    // 종합부동산세 (상한·단수 처리 후)
  ruralSurtax: number         // 농어촌특별세
  total: number
}

/** 1세대 1주택 세액공제 상세 — 연령분·보유기간분 각각과 합산 한도 적용 여부 */
export interface ComprehensiveTaxCreditDetail {
  agePercent: number            // 연령 공제율(%) — 미해당이면 0
  holdingPercent: number        // 보유기간 공제율(%) — 미해당이면 0
  totalPercentApplied: number   // 실제 적용 합계(%) — 합산 한도 반영
  capReached: boolean           // 합산 한도에 걸렸는지
  amount: number                // 공제액(원)
}

/**
 * @타입: ComprehensiveSuccess
 * @설명: 종합부동산세 계산 성공 결과. "나도 내는 건가"가 가장 큰 관심사라
 *        과세 대상 여부(taxable)와 그 사유를 최상위로 담고, 중과 표 사용 여부·
 *        세액공제 상세·상한 처리도 전부 사유와 함께 담는다.
 */
export interface ComprehensiveSuccess {
  ok: true
  baseDate: string                       // 산출된 과세기준일 (YYYY-MM-DD)
  /** 과세 대상 여부 — false면 세액 0, 왜 대상이 아닌지 사유 필수 */
  taxable: boolean
  notTaxableReason: string | null
  /** 기본공제 — 어느 기준이 얼마 적용됐는지 */
  basicDeductionApplied: number
  basicDeductionType: 'one_house' | 'general'
  taxBase: number                        // 과세표준 (0이면 과세 대상 아님)
  /** 세율 — 중과 표를 썼는지와 사유 */
  heavyTableApplied: boolean
  rateReason: string
  /** 1세대 1주택 세액공제 — 해당 없으면 null */
  taxCredit: ComprehensiveTaxCreditDetail | null
  /** 세부담 상한 — 적용/이내/미적용(사유) (재산세와 같은 상태 구조) */
  burdenCap: PropertyCapStatus
  breakdown: ComprehensiveBreakdown
  appliedRules: AppliedRuleInfo[]        // 재산세 공제 계산에 쓰인 재산세 룰 포함
  ruleMode: TaxRuleMode
  containsProposedRule: boolean
  /** 값 미입력(미확정)으로 판정하지 못한 조건 — 빈 배열이면 없음 */
  unresolvedFields: string[]
}

export type ComprehensiveResult = ComprehensiveSuccess | TaxEngineFailure
