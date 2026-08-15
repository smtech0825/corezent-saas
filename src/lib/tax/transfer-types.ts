/**
 * @파일: lib/tax/transfer-types.ts
 * @설명: 양도소득세 엔진의 입력·결과·rule_value(jsonb) 스키마 타입.
 *        ⚠️ 세율·공제율·구간·기준액·연수 요건·날짜(중과 유예·경과조치 기한 포함) 등
 *        실제 숫자는 이 파일에 절대 넣지 않는다 — 구조(스키마)만 정의하고 값은 전부
 *        DB(tax_rules)에서 읽는다. 중과의 유예/재개 시기는 별도 날짜 필드가 아니라
 *        transfer.heavy 룰의 시행기간(effective_from/to) 이력으로 표현한다.
 *        (engine-types.ts가 300줄을 초과한 상태라 양도세 타입은 이 파일로 분리 — 공통
 *        타입(RateSpec·Conditions·AppliedRuleInfo 등)은 engine-types.ts의 것을 그대로 쓴다)
 */

import type { TaxRuleMode } from './types'
import type { AppliedRuleInfo, Conditions, RateSpec, TaxEngineFailure } from './engine-types'
import type { DayInclusionMode } from './period'

// ─── rule_value 공통 행 형태 ──────────────────────────────────────────────────

/** 세율 행 — 단기 보유 세율표·지방소득세 단기표에 사용 (조건: holding_years 등) */
export interface TransferRateRow {
  when: Conditions
  priority?: number
  rate: RateSpec
}

/** 중과 가산 행 — 기본 누진세율에 더할 가산 포인트(%p). 값은 관리자 입력 */
export interface TransferHeavyRow {
  when: Conditions
  priority?: number
  addPercentPoints: number
}

/**
 * 경과조치 행 — 계약일부터 양도까지 허용되는 '개월 수'(지역 조건별). 값은 관리자 입력.
 * 지역 구분은 when 조건(sido·sigungu·is_metro)으로 표현한다 — 예: 특정 구 목록 행(높은
 * priority) + 조건 없는 공통 행. 코드는 "지역별 기간을 찾아 계약일에 더한다"만 안다.
 */
export interface TransferGraceRow {
  when: Conditions
  priority?: number
  monthsFromContract: number
}

/** 장기보유특별공제 행 — 연수 조건별 공제율(%). 값은 관리자 입력 */
export interface TransferLtsdRow {
  when: Conditions
  priority?: number
  deductPercent: number
}

// ─── rule_value 스키마 (룰 키별) ─────────────────────────────────────────────

/** transfer.base_rates — 기본세율(누진 구조 RateSpec) */
export interface TransferBaseRatesValue {
  rate: RateSpec
}

/** transfer.short_term_rates — 단기 보유 세율표. 조건에 맞는 행이 없으면 단기 미해당 */
export interface TransferShortTermValue {
  rows: TransferRateRow[]
}

/**
 * transfer.heavy — 다주택 중과 가산과 경과조치.
 * 중과가 유예된 기간은 이 룰의 시행기간 이력(effective_from/to)으로 표현한다 —
 * 기준일에 유효한 heavy 룰이 없으면 중과 없음(날짜를 코드·값에 이중으로 두지 않는다).
 * grace(경과조치): 계약 마감일 이전에 매매계약을 체결하고 계약금을 받은 경우,
 * 계약일부터 rows의 개월 수(지역 조건별) 안에 양도하면 중과를 면한다.
 * finalDeadline이 있으면 그 날짜까지 양도한 경우에만 면제된다.
 * 마감일·개월 수·지역 목록은 전부 관리자가 룰에 입력한다 — 코드에 없다.
 */
export interface TransferHeavyValue {
  rows: TransferHeavyRow[]
  grace?: {
    contractDeadline: string     // YYYY-MM-DD — 이 날짜 이전(포함) 계약 체결·계약금 수령
    rows: TransferGraceRow[]     // 지역 조건별 허용 연수 (조건 없는 행 = 공통)
    finalDeadline?: string       // YYYY-MM-DD — 최종 양도 기한 (없으면 연수 조건만)
  }
}

/**
 * transfer.ltsd.general — 장기보유특별공제 일반 표. 두 형식을 지원한다(같은 키에 혼합 금지):
 *   구 형식(확정법): { rows } — 보유 연수(holding_years_ltsd) 조건 단일 표
 *   신 형식(개정안): { holdingRows, residenceRows } — 보유분·거주분(residence_years 조건) 중
 *   높은 쪽 하나만 적용. 거주기간 미입력이면 보유분만 적용하고 그 사실을 안내한다.
 *   신 형식에서 holdingRows 생략 = 보유 기준 공제 폐지(거주 기준만 — 2029년 단계 표현).
 *   residenceRows는 신 형식의 필수 필드다(보유만 있는 표는 구 형식으로 등록).
 * 확정법 룰은 재등록 없이 구 형식 그대로 동작한다. 파서가 형식을 판별해 반환한다.
 */
export type TransferLtsdGeneralParsed =
  | { format: 'holding_only'; rows: TransferLtsdRow[] }
  | { format: 'max_residence'; holdingRows?: TransferLtsdRow[]; residenceRows: TransferLtsdRow[] }

/**
 * transfer.ltsd.cap — 장기보유특별공제 '물건별' 한도(원). 개정안 룰 — 기준일에 유효한
 * 룰이 없으면 한도를 적용하지 않는다(확정법에는 한도 규정이 없다).
 * 같은 해 여러 물건 양도 시의 '인별' 합산 한도는 단일 물건 계산기가 알 수 없어
 * 적용하지 않으며, 화면 판단 한계에 그 사실을 명시한다.
 */
export interface TransferLtsdCapValue {
  perPropertyAmount: number   // 물건별 한도액 (원) — 관리자 입력
}

/**
 * transfer.ltsd.one_house — 장기보유특별공제 큰 표(1세대 1주택 + 거주 요건 충족 시).
 * 보유분(holdingRows)·거주분(residenceRows)을 각각 찾아 합산한다.
 * minResidenceYears: 이 표를 쓰기 위한 최소 거주 연수 — 지역과 무관하게 항상 적용
 * (비과세의 거주 요건과 별개 조문·별개 조건이다. 절대 혼용 금지).
 * ⚠️ holdingRows 생략 = 그 시행기간의 '보유 기준 공제 폐지'(2026 개편안의 2029년 단계
 * 표현). 빈 배열·0% 행이 아니라 필드 생략으로 표현한다 — 엔진이 보유분 0%로 계산하고
 * 사유에 폐지를 명시한다. 거주분(residenceRows)은 항상 필수다.
 */
export interface TransferLtsdOneHouseValue {
  minResidenceYears: number
  holdingRows?: TransferLtsdRow[]    // 조건: holding_years_ltsd — 생략하면 보유 기준 공제 없음(폐지)
  residenceRows: TransferLtsdRow[]   // 조건: residence_years
}

/** 기본공제 행(신 형식) — 조건(거주기간·양도가액 등)별 공제액(원). 값은 관리자 입력 */
export interface TransferBasicDeductionRow {
  when: Conditions
  priority?: number
  amount: number
}

/**
 * transfer.basic_deduction — 기본공제. 두 형식을 지원한다(같은 키에 혼합 금지):
 *   구 형식(확정법): { amount } 고정 금액
 *   신 형식(개정안): { rows } — 행 조건(residence_years·transfer_price 등)별 금액
 * 확정법 룰은 재등록 없이 구 형식 그대로 동작한다. 파서가 형식을 판별해 반환한다.
 */
export type TransferBasicDeductionParsed =
  | { format: 'fixed'; amount: number }
  | { format: 'rows'; rows: TransferBasicDeductionRow[] }

/**
 * transfer.exemption — 1세대 1주택 비과세 요건과 고가주택 기준.
 * residenceIfAcquiredRegulated: '취득 당시' 조정대상지역이었던 경우에만 적용되는
 * 거주 요건(연수) — 장기보유특별공제 큰 표의 거주 요건(항상 적용)과 다르다. 혼용 금지.
 */
export interface TransferExemptionValue {
  minHoldingYears: number
  residenceIfAcquiredRegulated: { minYears: number }
  highPriceThreshold: number    // 고가주택 기준(양도가액, 원) — 초과분 비율만 과세
}

/** transfer.temporary_two_house — 일시적 2주택: 신규주택 취득일부터 허용 연수 */
export interface TransferTemporaryTwoHouseValue {
  maxYearsFromNewAcquisition: number
}

/**
 * transfer.local_income_tax — 지방소득세. 양도소득세액의 10%가 아니라 같은 과세표준에
 * 별도 세율표를 적용하는 독립 세목이므로, 국세와 병렬 구조(기본·단기·중과)를 갖는다.
 * 국세가 단기·중과 경로일 때 대응 표(shortTerm·heavyRows)가 없으면 계산을 중단한다
 * (국세의 1/10로 추정하지 않는다).
 */
export interface TransferLocalIncomeTaxValue {
  rate: RateSpec
  shortTerm?: { rows: TransferRateRow[] }
  heavyRows?: TransferHeavyRow[]
}

/** transfer.period_rule — 연수 계산 방식(초일 산입 여부). 값은 관리자가 확인 후 입력 */
export interface TransferPeriodRuleValue {
  dayInclusion: DayInclusionMode
}

// ─── 계산기 입력 ──────────────────────────────────────────────────────────────

/** 양도 당시 보유 주택 수 — 3은 '3주택 이상' */
export type TransferHouseCount = 1 | 2 | 3

/**
 * @타입: TransferInput
 * @설명: 양도소득세 계산 입력. 개인식별정보(이름·이메일·IP)는 포함하지 않는다.
 *        보유기간 기산일 규칙(상속 자산의 세율용/공제용 분리)은 엔진이 조문에 따라
 *        입력 날짜들로부터 결정한다.
 */
export interface TransferInput {
  baseDate: string                // 양도일 = 계산 기준일 (YYYY-MM-DD)
  acquiredAt: string              // 취득일 (YYYY-MM-DD)
  regionCode: string              // 소재지 행정구역 코드 — '양도 당시' 조정대상지역 판정용
  sido?: string                   // 소재지 시·도 이름 — 경과조치 지역 조건·is_metro 판정용
  sigungu?: string                // 소재지 시·군·구 이름 — 경과조치의 구 단위 지역 조건용
  transferPrice: number           // 양도가액 (원)
  acquirePrice: number            // 취득가액 (원)
  expenses?: number               // 필요경비(취득세·중개수수료·자본적지출 등, 원) — 비우면 0
  houseCount: TransferHouseCount  // 양도 당시 1세대 보유 주택 수
  residenceYears?: number         // 거주기간(만 연수) — 1주택 비과세·장특공제 큰 표 판정용
  /**
   * '취득 당시' 조정대상지역이었는지 — 비과세 거주 요건 판정 전용.
   * 과거 이력이 DB에 없어 자동 판정이 불가능하므로 사용자가 직접 선택한다.
   * '양도 당시' 판정(중과)은 tax_regulated_areas 이력으로 자동 수행 — 혼용 금지.
   */
  acquiredInRegulatedArea?: boolean
  isTemporaryTwoHouse?: boolean   // 2주택 — 일시적 2주택 여부
  newHouseAcquiredAt?: string     // 2주택 — 신규주택 취득일 (일시적 2주택 판정용)
  inherited?: boolean             // 상속받은 주택 여부
  inheritanceOpenedAt?: string    // 상속개시일 — 공제·비과세 보유기간 기산(제95조④ 계열)
  decedentAcquiredAt?: string     // 피상속인 취득일 — 세율용 보유기간 기산(제104조②)
  graceContractDate?: string      // 경과조치 — 매매계약 체결일 (해당 시)
  graceDepositReceived?: boolean  // 경과조치 — 계약금 수령 여부
}

// ─── 계산 결과 ────────────────────────────────────────────────────────────────

/** 계산 과정 각 단계 금액 — 화면이 단계별로 그대로 보여준다 */
export interface TransferBreakdown {
  transferGain: number        // 양도차익 (고가주택 안분 후)
  ltsdAmount: number          // 장기보유특별공제액
  taxableGain: number         // 양도소득금액
  basicDeduction: number      // 기본공제 (실제 차감액)
  taxBase: number             // 과세표준
  transferTax: number         // 양도소득세 (단수 처리 후)
  localIncomeTax: number      // 지방소득세 (단수 처리 후)
  totalTax: number
  netProceeds: number         // 손에 쥐는 돈 = 양도가액 − 취득가액 − 필요경비 − 세금 합계
}

/**
 * 신고 시점 완화 특례 안내(개정안) — 중과가 적용된 양도가, 양도일 이후 시행되는 완화
 * 룰(transfer.heavy·proposed)의 시행일 이후에 예정·확정신고하면 완화 세율이 적용될 수
 * 있는 경우의 안내 재료. 계산기는 신고 시점을 모르므로 자동 반영하지 않는다 — 화면이
 * 안내만 한다. effectiveFrom·reliefPoints가 null이면 룰 값을 읽지 못했거나 판정하지
 * 못한 것 — 날짜·수치 없는 일반 안내로 표시한다. 날짜·가산율은 전부 룰에서 온다.
 */
export interface TransferFilingReliefNotice {
  effectiveFrom: string | null   // 완화 룰 시행일 (YYYY-MM-DD) — 룰에서 읽음
  reliefPoints: number | null    // 이 입력 조건의 완화 가산(%p) — 룰에서 읽음
  currentPoints: number          // 현재 계산에 적용된 가산(%p)
}

/**
 * '취득 당시' 조정대상지역 판정 결과 — 어떤 값을 어디서 얻었는지.
 * source가 'auto'면 designatedFrom·sourceUrl로 근거를 보여주고(비규제로 판정된 경우
 * 근거 이력이 없으므로 둘 다 null), 'user'면 사용자가 직접 지정한 값이다.
 */
export interface TransferAcquiredRegulatedInfo {
  value: boolean
  source: 'user' | 'auto'
  designatedFrom: string | null
  sourceUrl: string | null
}

/** 장기보유특별공제에 실제 사용된 표 */
export type TransferLtsdTable = 'one_house' | 'general' | 'none'

/** 세액 산출에 채택된 경로 — 비교과세 결과 */
export type TransferRatePath = 'base' | 'heavy' | 'short_term'

/**
 * @타입: TransferSuccess
 * @설명: 양도소득세 계산 성공 결과. 어느 공제 표를 왜 썼는지, 중과·경과조치·비교과세가
 *        어떻게 적용됐는지를 전부 담는다 — 이 계산기에서 가장 오해가 많은 부분이므로
 *        화면이 사유를 그대로 보여줄 수 있어야 한다.
 */
export interface TransferSuccess {
  ok: true
  /** 비과세 여부 — true면 세액 0, 사유 필수 */
  exempt: boolean
  exemptReason: string | null
  /** 고가주택 안분 적용 여부와 과세 비율(0~1) */
  highPriceApplied: boolean
  taxableRatio: number
  breakdown: TransferBreakdown
  /** 장기보유특별공제 — 어느 표를 왜 썼는지 */
  ltsdTable: TransferLtsdTable
  ltsdReason: string
  ltsdPercentTotal: number        // 적용 공제율 합계(%)
  /** 물건별 공제 한도(transfer.ltsd.cap — 개정안 룰)로 공제액이 잘렸는지 */
  ltsdCapApplied: boolean
  /** 다주택 중과 */
  heavyApplied: boolean           // 가산이 실제 반영됐는지
  heavyExemptedByGrace: boolean   // 경과조치로 면제됐는지
  heavyReason: string
  /** 신고 시점 완화 특례 안내(개정안) — 해당 없으면 null */
  filingRelief: TransferFilingReliefNotice | null
  /** 비교과세 — 채택 경로와 비교 대상 세액(절사 전) */
  ratePathChosen: TransferRatePath
  comparisonApplied: boolean
  /** 판정에 사용된 값들 (화면 표시·이력용) */
  holdingYearsForRate: number
  holdingYearsForLtsd: number
  /**
   * 거주 요건 판정에 실제 사용된 거주기간(만 연수) — 어떤 판정에도 안 썼으면 null.
   * 거주기간 산정의 초일 산입 방식은 법령·집행기준에서 확인되지 않았으므로, 이 값이
   * null이 아니면 화면이 그 한계를 안내한다(보유기간과 같은 방식을 전제로 입력받음).
   */
  residenceYearsUsed: number | null
  regulatedAtTransfer: boolean    // '양도 당시' 조정대상지역 여부 (이력 자동 판정)
  /**
   * '취득 당시' 조정대상지역 판정 — 비과세 거주 요건 판정에 쓴 값과 그 출처·근거.
   * 판정이 필요 없던 경우(1주택 트랙이 아니거나 보유 요건 미충족)에는 null.
   * 화면은 자동 판정이면 근거(지정일·공고)를 보여주고, 사용자가 고칠 수 있게 한다.
   */
  acquiredRegulated: TransferAcquiredRegulatedInfo | null
  appliedRules: AppliedRuleInfo[]
  ruleMode: TaxRuleMode
  containsProposedRule: boolean
  /** 값 미입력(미확정)으로 판정하지 못한 조건 — 화면이 눈에 띄게 표시한다 */
  unresolvedFields: string[]
}

export type TransferResult = TransferSuccess | TaxEngineFailure
