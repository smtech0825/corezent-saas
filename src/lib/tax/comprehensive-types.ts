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
import type { PropertyCapStatus, PropertyRatioRow } from './property-types'
import type { AmountSpec } from './amount-spec'

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

/** 세액공제 행 — 연령별·보유기간별(구 형식)·거주기간별(신 형식) 공제율(%). 값은 관리자 입력 */
export interface ComprehensiveCreditRow {
  when: Conditions
  priority?: number
  creditPercent: number
}

/**
 * 기본공제 행(신 형식 — 2026 세제개편안) — 조건(when)으로 대상을 고르고 금액은
 * AmountSpec(고정 또는 '기준액 + 가산액 × 비중' 산식)으로 계산한다.
 * label은 화면 표시용 한국어 라벨(선택) — 어느 기준의 공제인지 결과에 그대로 보여준다.
 */
export interface ComprehensiveBasicDeductionRow {
  when: Conditions
  priority?: number
  deduction: AmountSpec
  label?: string
}

// ─── rule_value 스키마 (룰 키별) ─────────────────────────────────────────────

/**
 * comprehensive.basic_deduction — 기본공제. 두 형식을 지원한다(같은 키에 혼합 금지):
 *   구 형식(확정법): { generalAmount, oneHouseAmount } — 1세대 1주택 여부 이지선다
 *   신 형식(개정안): { rows: [...] } — 행 조건(거주 여부·주택 수 등) + AmountSpec 금액
 * 확정법 룰은 재등록 없이 구 형식 그대로 동작한다. 파서가 형식을 판별해 반환한다.
 */
export type ComprehensiveBasicDeductionParsed =
  | { format: 'fixed_pair'; generalAmount: number; oneHouseAmount: number }
  | { format: 'rows'; rows: ComprehensiveBasicDeductionRow[] }

/**
 * comprehensive.assessment_ratio — 공정시장가액비율. 두 형식을 지원한다:
 *   구 형식(확정법): { ratioPercent } 단일 값 (재산세 검증기 공유)
 *   신 형식(개정안): { rows: [{ when, ratioPercent }] } — 주택 수·조정대상지역 보유 등
 *   행 조건별 비율 (재산세 1주택 특례 비율과 같은 행 구조 — 검증기 공유)
 */
export type ComprehensiveAssessmentRatioParsed =
  | { format: 'single'; ratioPercent: number }
  | { format: 'rows'; rows: PropertyRatioRow[] }

/** comprehensive.rates — 세율표(일반/중과 행 혼합, heavy 표시로 구분) */
export interface ComprehensiveRatesValue {
  rows: ComprehensiveRateRow[]
}

/**
 * comprehensive.tax_credit — 1세대 1주택 세액공제. 두 형식을 지원한다:
 *   구 형식(확정법): { ageRows, holdingRows, maxTotalPercent } — 연령분·보유분 합산 + % 한도.
 *   신 형식(개정안): { ageRows, holdingRows?, residenceRows, maxTotalPercent, maxAmount } —
 *   연령분은 그대로 합산(좌동)하고, 보유분·거주분 '둘 중에서만' 높은 쪽 하나를 골라 더한 뒤
 *   합산 % 한도(좌동)로 자르고, 그다음 금액 한도(원·신설)로 자른다.
 *   holdingRows 생략 = 그 시행기간의 보유 기준 공제 폐지(양도세 장특공제와 같은 표현 —
 *   빈 배열·0% 행이 아니라 필드 생략). residenceRows·maxAmount 존재가 신 형식의 판별 기준이다.
 *   조건에 맞는 행이 없으면 그 축의 공제는 0(미매칭=공제 없음이 정상 의미).
 */
export type ComprehensiveTaxCreditParsed =
  | {
      format: 'sum_holding'
      ageRows: ComprehensiveCreditRow[]        // 조건: age (만 나이)
      holdingRows: ComprehensiveCreditRow[]    // 조건: holding_years (만 연수)
      maxTotalPercent: number                  // 합산 한도(%) — 관리자 입력
    }
  | {
      format: 'age_plus_max'
      ageRows: ComprehensiveCreditRow[]        // 조건: age (만 나이) — 항상 합산
      holdingRows?: ComprehensiveCreditRow[]   // 조건: holding_years — 생략하면 보유 기준 공제 없음(폐지)
      residenceRows: ComprehensiveCreditRow[]  // 조건: residence_years (만 연수)
      maxTotalPercent: number                  // 합산 한도(%) — 관리자 입력 (좌동)
      maxAmount: number                        // 공제액 한도(원) — 관리자 입력 (신설)
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

// comprehensive.assessment_ratio — 구/신 형식은 위 ComprehensiveAssessmentRatioParsed 참조.
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
  holdingYears?: number                 // 1세대 1주택 — 보유기간 (만 연수, 구 형식 보유 세액공제 판정)
  prevTotalTax?: number                 // 직전 연도 총세액(재산세+종부세 상당액, 원) — 선택
  // ── 2026 세제개편안(신 형식 룰) 판정용 — 신 형식 룰이 등록된 시점에만 실제로 쓰인다 ──
  residenceYears?: number               // 1세대 1주택 — 거주기간 (만 연수, 신 형식 거주 세액공제 판정)
  isResiding?: boolean                  // 1세대 1주택 — 해당 주택에 현재 거주 중인지 (신 형식 기본공제 갈림)
  /**
   * 현재 거주 중인 주택의 공시가격 (원) — 다주택 기본공제 산식의 분자.
   * 거주 중인 주택이 없으면 0을 입력한다(미입력과 0은 다르다 — 미입력이면 산식 계산이
   * 중단되고 입력을 요구한다). 공시가격 합계를 넘을 수 없다.
   */
  residingOfficialPrice?: number
  /**
   * 조정대상지역 내 주택 보유 여부 — 신 형식 공정시장가액비율 등의 행 조건.
   * 인별 합산 입력이라 주소가 없어 자동 판정이 불가능하므로 사용자가 직접 선택한다.
   */
  hasRegulatedHouse?: boolean
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

/**
 * 1세대 1주택 세액공제 상세.
 * 구 형식(확정법): 연령분+보유분 합산 — capReached는 % 합산 한도 도달 여부.
 * 신 형식(개정안): 연령분(합산 유지) + 보유분·거주분 중 높은 쪽 하나(chosenAxis).
 * 합산 % 한도(capReached — 좌동) 적용 후 공제액 한도(amountCapApplied — 신설) 순서로 자른다.
 */
export interface ComprehensiveTaxCreditDetail {
  agePercent: number            // 연령 공제율(%) — 미해당이면 0. 구·신 형식 모두 합산 대상
  holdingPercent: number        // 보유기간 공제율(%) — 미해당·폐지면 0
  totalPercentApplied: number   // 실제 적용 합산(%) — % 한도 반영 후
  capReached: boolean           // % 합산 한도에 걸렸는지 (구·신 형식 공용)
  amount: number                // 공제액(원) — 모든 한도 적용 후
  residencePercent?: number     // 신 형식 — 거주기간 공제율(%). 미해당이면 0
  /** 신 형식 — 보유분·거주분 중 채택된 축 (동률이면 보유분으로 표기 — 공제액 동일) */
  chosenAxis?: 'holding' | 'residence'
  amountCapApplied?: boolean    // 신 형식 — 공제액 한도(원)로 잘렸는지 (% 한도 다음 순서)
  /** 신 형식 — 룰에 보유 표(holdingRows)가 없는 시행기간(보유 기준 공제 폐지)인지 */
  holdingAbolished?: boolean
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
  /** 신 형식(개정안) 룰의 행 라벨(관리자 입력 한국어) — 구 형식이면 null */
  basicDeductionLabel: string | null
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
