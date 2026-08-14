/**
 * @파일: lib/tax/property-types.ts
 * @설명: 재산세(주택분) 엔진의 입력·결과·rule_value(jsonb) 스키마 타입.
 *        ⚠️ 세율·비율·구간·금액·날짜(과세기준일 월·일 포함) 등 실제 숫자는 이 파일에
 *        절대 넣지 않는다 — 구조(스키마)만 정의하고 값은 전부 DB(tax_rules)에서 읽는다.
 *        1세대 1주택 공정시장가액비율 특례는 연도가 조문에 못박힌 한시 특례라
 *        별도 룰 키(property.assessment_ratio.one_house)의 시행기간(종료일)으로 표현한다 —
 *        룰이 만료되면 자동으로 일반 비율이 적용된다(transfer.heavy의 유예 표현과 같은 방식).
 *        (engine-types.ts가 300줄을 초과한 상태라 재산세 타입은 이 파일로 분리 — 공통
 *        타입(RateSpec·Conditions·AppliedRuleInfo 등)은 engine-types.ts의 것을 그대로 쓴다)
 */

import type { TaxRuleMode } from './types'
import type { AppliedRuleInfo, Conditions, RateSpec, TaxEngineFailure } from './engine-types'

// ─── rule_value 행 형태 ──────────────────────────────────────────────────────

/** 공정시장가액비율 행 — 1세대 1주택 특례(공시가격 구간별). 비율 값은 관리자 입력 */
export interface PropertyRatioRow {
  when: Conditions
  priority?: number
  ratioPercent: number    // 공정시장가액비율(%) — 관리자 입력
}

/** 세부담 상한 행 — 공시가격 구간별 상한 비율. 값은 관리자 입력 */
export interface PropertyBurdenCapRow {
  when: Conditions
  priority?: number
  capPercent: number      // 직전 연도 세액 대비 상한 비율(%) — 관리자 입력
}

// ─── rule_value 스키마 (룰 키별) ─────────────────────────────────────────────

/** property.assessment_ratio — 일반 공정시장가액비율 */
export interface PropertyAssessmentRatioValue {
  ratioPercent: number    // 공정시장가액비율(%) — 관리자 입력
}

/**
 * property.assessment_ratio.one_house — 1세대 1주택 공정시장가액비율 특례(구간별).
 * 한시 특례라 이 룰의 시행기간(effective_to)이 종료일을 표현한다 — 기준일에 유효한
 * 룰이 없으면 엔진이 일반 비율로 자동 전환한다(코드·값 어디에도 연도를 두지 않는다).
 */
export interface PropertyAssessmentRatioOneHouseValue {
  rows: PropertyRatioRow[]    // 조건: official_price (구간은 min+priority 오름차순)
}

/**
 * property.rates — 재산세 세율표.
 * general은 항상 필요하고, oneHouse(1세대 1주택 특례세율표)는 선택이다 —
 * 1세대 1주택이면서 공시가격이 maxOfficialPrice 이하일 때만 특례세율을 쓴다.
 * 특례가 종료된 기간에는 oneHouse를 뺀 새 룰 행을 등록하면 된다.
 */
export interface PropertyRatesValue {
  general: RateSpec
  oneHouse?: {
    maxOfficialPrice: number    // 특례세율 적용 공시가격 상한(원) — 관리자 입력
    rate: RateSpec
  }
}

/**
 * property.surtax — 재산세에 함께 붙는 세목.
 * localEducation(지방교육세)은 재산세 본세에, urbanArea(도시지역분)는 과세표준에 비례한다 —
 * 어느 금액에 곱하는지는 코드(계산 순서)가 알고, 비율 값은 전부 관리자가 입력한다.
 */
export interface PropertySurtaxValue {
  localEducation: RateSpec    // 지방교육세 — 재산세 본세 기준
  urbanArea: RateSpec         // 도시지역분 — 과세표준 기준 (도시지역만)
}

/**
 * property.base_cap — 과세표준 상한.
 * 상한액 = 직전 연도 과세표준 + (기준 과세표준 × increasePercent/100).
 * increaseBasis가 기준 과세표준이 무엇인지 정한다 — current_base(당해 연도 상한 적용 전
 * 과세표준) 또는 previous_base(직전 연도 과세표준). 법령 산식 해석은 관리자(지시서)가
 * 정하고 코드는 두 구조만 안다.
 */
export interface PropertyBaseCapValue {
  increasePercent: number
  increaseBasis: 'current_base' | 'previous_base'
}

/**
 * property.burden_cap — 세부담 상한(공시가격 구간별). 옛 제도의 경과조치는 이 룰의
 * 시행기간으로 표현한다 — 기준일에 유효한 룰이 없으면 상한 미적용이 정상이다.
 * 상한액 = 직전 연도 재산세액(본세) × capPercent/100. 본세에만 적용한다.
 */
export interface PropertyBurdenCapValue {
  rows: PropertyBurdenCapRow[]    // 조건: official_price (구간은 min+priority 오름차순)
}

/**
 * property.assessment_date — 과세기준일(월·일). 값은 관리자가 법령 근거와 함께 입력하며
 * 코드에는 어떤 월·일도 넣지 않는다. 엔진이 과세연도와 조합해 기준일(YYYY-MM-DD)을 만든다.
 */
export interface PropertyAssessmentDateValue {
  month: number    // 월 (1~12)
  day: number      // 일 (1~31)
}

// property.rounding은 취득세·양도세와 같은 RoundingValue(engine-types.ts)를 그대로 쓴다.

/**
 * 엔진 동작 옵션 — mainTaxOnly: 본세만 계산(종합부동산세의 재산세 상당액 공제용).
 * 공제 계산은 본세만 쓰므로 이 모드에서는 부가 세목(property.surtax) 룰을 요구하지 않고
 * 도시지역분·지방교육세를 0으로 둔다. 공개 재산세 계산기는 이 옵션을 쓰지 않는다.
 */
export interface PropertyEngineOptions {
  mainTaxOnly?: boolean
}

// ─── 계산기 입력 ──────────────────────────────────────────────────────────────

/**
 * @타입: PropertyInput
 * @설명: 재산세(주택분) 계산 입력. 개인식별정보(이름·이메일·IP)는 포함하지 않는다.
 *        직전 연도 값 2종은 선택 입력 — 비우면 해당 상한을 적용하지 않고 그 사실을
 *        결과에 담는다(추정 금지. 상한은 세액을 낮추는 장치라 실제 고지서가 낮을 수 있다).
 */
export interface PropertyInput {
  taxYear: number          // 과세연도 (YYYY) — 과세기준일은 룰(월·일)과 조합해 산출
  officialPrice: number    // 공시가격 (원)
  isOneHouse: boolean      // 1세대 1주택 여부
  isUrbanArea: boolean     // 도시지역 여부 — 도시지역분 포함 여부 (아파트는 대부분 해당)
  prevTaxBase?: number     // 직전 연도 과세표준 (원) — 없으면 과세표준 상한 미적용
  prevTaxAmount?: number   // 직전 연도 재산세액(본세, 원) — 없으면 세부담 상한 미적용
}

// ─── 계산 결과 ────────────────────────────────────────────────────────────────

/**
 * 상한(과세표준·세부담) 적용 상태 — 화면이 "적용했는지, 못 했다면 왜인지"를 그대로 보여준다.
 * applied: 상한으로 잘렸다 / not_exceeded: 상한 밑이라 영향 없음 / skipped: 판정 불가(사유 필수)
 */
export type PropertyCapStatus =
  | { status: 'applied'; capAmount: number }
  | { status: 'not_exceeded'; capAmount: number }
  | { status: 'skipped'; reason: string }

/** 세액 분해 — 반드시 항목별로 따로 담는다. 합계만 반환하지 않는다 */
export interface PropertyBreakdown {
  mainTax: number             // 재산세 본세 (상한·단수 처리 후)
  urbanAreaTax: number        // 도시지역분 (도시지역이 아니면 0)
  localEducationTax: number   // 지방교육세
  total: number
}

/**
 * @타입: PropertySuccess
 * @설명: 재산세 계산 성공 결과. 어떤 공정시장가액비율·세율표를 왜 썼는지, 상한 2종이
 *        각각 어떻게 처리됐는지를 전부 담는다 — 화면이 사유를 그대로 보여줄 수 있어야 한다.
 */
export interface PropertySuccess {
  ok: true
  baseDate: string                 // 산출된 과세기준일 (YYYY-MM-DD) — 룰의 월·일과 과세연도 조합
  taxBaseBeforeCap: number         // 과세표준 (상한 적용 전)
  taxBase: number                  // 과세표준 (상한 적용 후 — 세율은 이 값에 적용)
  /** 공정시장가액비율 — 어느 비율을 왜 적용했는지 */
  assessmentRatioPercent: number
  assessmentRatioType: 'general' | 'one_house'
  assessmentRatioReason: string
  /** 세율표 — 어느 표를 왜 적용했는지 */
  rateTable: 'general' | 'one_house_special'
  rateTableReason: string
  /** 상한 2종 — 각각의 적용 상태와 사유 */
  baseCap: PropertyCapStatus
  burdenCap: PropertyCapStatus
  urbanAreaIncluded: boolean       // 도시지역분 포함 여부 (입력 그대로 — 화면 안내용)
  breakdown: PropertyBreakdown
  appliedRules: AppliedRuleInfo[]
  ruleMode: TaxRuleMode
  containsProposedRule: boolean
  /** 값 미입력(미확정)으로 판정하지 못한 조건 — 빈 배열이면 없음 */
  unresolvedFields: string[]
}

export type PropertyResult = PropertySuccess | TaxEngineFailure
