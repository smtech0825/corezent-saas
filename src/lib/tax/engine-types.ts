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

/** 증여 과세표준 기준 값 — market_value(시가인정액) / official_price(공시가격=시가표준액) */
export type GiftTaxBasis = 'market_value' | 'official_price'

/**
 * @타입: AcquisitionInput
 * @설명: 취득세 계산 입력. 개인식별정보(이름·이메일·IP)는 포함하지 않는다.
 */
export interface AcquisitionInput {
  baseDate: string           // 취득일 = 계산 기준일 (YYYY-MM-DD)
  regionCode: string         // 소재지 행정구역 코드 (tax_regulated_areas.region_code와 대조)
  sido?: string              // 소재지 시·도 이름 — is_metro(수도권) 판정용. 없으면 is_metro 미확정
  cause: AcquisitionCause
  price: number              // 취득가액 (원). 증여면 실제 지급대가 — 순수 증여는 0
  houseCountAfter: number    // 취득 후 1세대 주택 수
  areaOver85?: boolean       // (호환용) 전용면적 85㎡ 초과 여부 — areaSqm이 있으면 무시된다. 둘 다 없으면 미확정
  areaSqm?: number           // 전용면적(㎡, 원본 숫자). 있으면 area_sqm 조건에 쓰이고 area_over_85도 이 값에서 계산
  // 고급 입력 (기본 접힘)
  firstHome?: boolean            // 생애최초 취득 여부
  temporaryTwoHome?: boolean     // 일시적 2주택 여부
  donorRelation?: DonorRelation  // 증여 시 — 증여자와의 관계
  marketValue?: number           // 증여 시 — 시가인정액 (원)
  officialPrice?: number         // 공시가격(시가표준액) (원) — 증여 과세표준·중과 판정, 유상 저가주택 판정에 사용
  donorIsSingleHomeOwner?: boolean // 증여 시 — 증여자 1주택자 여부 (중과 배제 판단)
  giftTaxBaseChoice?: GiftTaxBasis // 증여 시 — 선택 가능 구간에서 납세자가 고른 과세표준 기준 (엔진이 가능하다고 알려준 경우에만)
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
  /**
   * 값 미입력(미확정)으로 판정하지 못한 조건 필드 목록 — 빈 배열이면 없음.
   * 예: 시가표준액을 비워 두면 저가주택 중과 제외 행을 판정하지 못하고 여기에 담긴다.
   * 화면이 이 사실을 근거 표시와 같은 비중으로 보여준다. 조용히 0·false로 대체하지 않는다.
   */
  unresolvedFields: string[]
  /** 증여 계산에 실제 사용된 과세표준 기준 — 유상취득 결과에는 없다 */
  giftTaxBaseUsed?: GiftTaxBasis
  /**
   * 과세표준 기준을 납세자가 고를 수 있었던 경우에만 존재.
   * selected가 null이면 선택 없이 기본 기준으로 계산된 것 — 화면이 이 정보로
   * 선택지를 띄우고 다시 계산하도록 안내한다(선택 가능 여부는 화면이 판단하지 않는다).
   */
  giftTaxBaseChoice?: { options: GiftTaxBasis[]; selected: GiftTaxBasis | null }
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
/**
 * @타입: RatePercentRounding
 * @설명: linear_by_base 산식 결과(세율%)의 소수점 반올림 지정.
 *        자릿수(decimals)·방식(method)은 전부 룰(관리자 입력)에서 온다 — 코드에 자릿수를 박지 않는다.
 *        지정이 없으면 반올림하지 않는다(기존 동작 유지).
 */
export interface RatePercentRounding {
  decimals: number                     // 소수점 이하 유지 자릿수 (0 이상 정수)
  method: 'round' | 'floor' | 'ceil'   // 반올림 / 버림 / 올림
}

export type RateSpec =
  | { type: 'fixed'; ratePercent: number }
  | {
      type: 'linear_by_base'
      per: number              // 과세표준 나눔 단위 (원)
      slopePercent: number
      interceptPercent: number
      minPercent?: number
      maxPercent?: number
      rounding?: RatePercentRounding  // 산식 결과 세율%의 소수점 처리 — 룰에서 지정
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

/**
 * rule_value: 증여 과세표준 기준 (acquisition.gift.tax_base)
 * base 하나만 있으면 기존처럼 그 기준으로 고정 계산한다.
 * choice가 정의돼 있으면 — basis로 지정한 값이 maxAmount 이하일 때 —
 * 납세자가 options 중에서 과세표준 기준을 고를 수 있다.
 * 기준 금액(maxAmount)·비교 대상(basis)·선택지(options)는 전부 관리자가
 * 룰에 입력하며, 코드에는 어떤 기준 금액도 넣지 않는다.
 */
export interface GiftTaxBaseValue {
  base: GiftTaxBasis                 // 기본 기준 — 시가인정액 / 공시가격(시가표준액)
  choice?: {
    basis: 'price' | GiftTaxBasis    // 구간 판정에 비교할 값 (price = 실제 지급대가)
    maxAmount: number                // 이 금액 이하이면 선택 가능 (원) — 관리자 입력
    options: GiftTaxBasis[]          // 고를 수 있는 기준 목록
  }
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

// ─── 인지세 (stamp) ───────────────────────────────────────────────────────────

/**
 * @타입: StampRateRow
 * @설명: 인지세 세액표 한 행 — 세율(%)이 아니라 정해진 금액(amount·원)이 붙는다.
 *        when 조건(price=계약금액, is_housing=주택 여부)은 취득세와 같은
 *        eq/min/max/in·priority 방식을 그대로 쓴다.
 *        비과세 행은 amount 0 + exemptReason(사유 문구 — 화면에 그대로 표시) 필수.
 *        금액·구간 값은 전부 관리자가 룰에 입력하며 코드에는 없다.
 */
export interface StampRateRow {
  when: Conditions
  priority?: number
  amount: number          // 인지세액(원) — 0이면 비과세 행
  exemptReason?: string   // 비과세 사유(관리자 입력 한국어 문구) — amount 0일 때만
}

/** rule_value: 인지세 세액표 (stamp.rates) */
export interface StampRatesValue {
  rows: StampRateRow[]
}

/** 인지세 계산 입력 — 개인식별정보는 포함하지 않는다 */
export interface StampInput {
  baseDate: string        // 계약일 = 계산 기준일 (YYYY-MM-DD)
  contractPrice: number   // 계약서 기재금액 (원)
  isHousing: boolean      // 주택 여부
}

/**
 * @타입: StampSuccess
 * @설명: 인지세 계산 성공 결과. 계약서 1통 기준(당사자가 여럿이어도 1통에 1회 과세).
 *        비과세면 amount 0 + exempt true + 사유를 함께 담아, 화면이 "왜 0원인지"를 표시한다.
 */
export interface StampSuccess {
  ok: true
  amount: number                  // 인지세액 (원)
  exempt: boolean                 // 비과세 여부
  exemptReason: string | null     // 비과세 사유 (룰의 관리자 입력 문구)
  appliedRules: AppliedRuleInfo[]
  ruleMode: TaxRuleMode
  containsProposedRule: boolean
}

export type StampResult = StampSuccess | TaxEngineFailure

/**
 * @타입: MetroScopeValue
 * @설명: 수도권 범위 (region.metro_scope, tax_type='common').
 *        수도권으로 취급할 시·도 이름 목록 — 목록은 관리자가 법령 근거와 함께 입력하며
 *        코드에는 어떤 시·도 이름도 박지 않는다. 이 룰이 없으면 is_metro는 미확정이 되어
 *        is_metro 조건을 쓰는 세율 행은 매칭되지 않는다(임의 false 간주 금지).
 */
export interface MetroScopeValue {
  sidoNames: string[]   // 수도권으로 취급할 시·도 이름 (regions.ts의 시·도 명칭과 동일 표기)
}

// ─── 중개수수료 (brokerage) ───────────────────────────────────────────────────
// ⚠️ 중개수수료는 세금이 아니라 '법정 상한'이다 — 엔진은 "이 금액을 넘을 수 없다"는
//    상한액만 계산하고, 실제 금액은 의뢰인과 개업공인중개사의 협의로 정해진다(화면이 안내).

/** 거래 유형 — sale_exchange(매매·교환) / lease(임대차) */
export type BrokerageDealType = 'sale_exchange' | 'lease'

/**
 * @타입: BrokerageRateRow
 * @설명: 중개수수료 상한 요율표 한 행. when 조건(deal_type·price·sido)은 취득세·인지세와
 *        같은 eq/min/max/in·priority 방식을 그대로 쓴다.
 *        조건에 sido가 없는 행은 전국 공통이고, 특정 시·도의 조례가 다르면 sido 조건을 단
 *        행을 더 높은 priority로 추가한다(시·도 조례 우선 구조).
 *        요율·한도액 값은 전부 관리자가 룰에 입력하며 코드에는 없다.
 */
export interface BrokerageRateRow {
  when: Conditions
  priority?: number
  ratePercent: number     // 상한 요율(%) — 관리자 입력
  limitAmount?: number    // 이 구간의 한도액(원) — 있으면 상한액이 이 금액을 넘지 않는다
}

/**
 * @타입: BrokerageLeaseConversion
 * @설명: 임대차 거래금액 환산 방식 — 환산액 = 보증금 + 월세 × multiplier.
 *        1차 환산액이 lowDeposit.thresholdAmount '미만'이면 lowDeposit.multiplier로
 *        다시 환산한다. 코드는 이 구조만 알고 배수·기준액 숫자는 전부 룰에서 온다.
 */
export interface BrokerageLeaseConversion {
  multiplier: number          // 월세 환산 배수 — 관리자 입력
  lowDeposit?: {
    thresholdAmount: number   // 1차 환산액이 이 금액 미만이면 대체 배수 적용 (원)
    multiplier: number        // 대체 배수
  }
}

/** rule_value: 중개수수료 상한 요율표 (brokerage.rates) */
export interface BrokerageRatesValue {
  rows: BrokerageRateRow[]
  leaseConversion: BrokerageLeaseConversion
}

/** rule_value: 중개수수료 부가가치세 (brokerage.vat) — 요율과 성격·개정 주기가 달라 분리 */
export interface BrokerageVatValue {
  ratePercent: number   // 부가가치세율(%) — 관리자 입력
}

/** 중개수수료 계산 입력 — 개인식별정보는 포함하지 않는다 */
export interface BrokerageInput {
  baseDate: string              // 기준일 (YYYY-MM-DD)
  dealType: BrokerageDealType   // 매매·교환 / 임대차
  sido: string                  // 소재지 시·도 이름 (regions.ts 표기와 동일)
  price?: number                // 매매·교환 — 거래금액 (원)
  deposit?: number              // 임대차 — 보증금 (원)
  monthlyRent?: number          // 임대차 — 월세 (원, 없으면 0)
}

/**
 * @타입: BrokerageSuccess
 * @설명: 중개수수료 상한 계산 성공 결과. capAmount는 '상한액'이며 실제 금액이 아니다 —
 *        화면이 이 구분을 결과 바로 옆에서 안내한다. 부가가치세는 별도 항목으로 담는다.
 */
export interface BrokerageSuccess {
  ok: true
  dealType: BrokerageDealType
  dealPrice: number                 // 요율이 적용된 거래금액 (임대차는 환산액)
  /** 임대차 환산 정보 — 매매·교환이면 null. multiplierUsed는 실제 적용된 배수(룰 값) */
  leaseConversion: { multiplierUsed: number; usedLowDeposit: boolean } | null
  capAmount: number                 // 중개보수 '상한액' (원) — 실제 금액은 협의로 결정
  appliedRatePercent: number        // 적용된 상한 요율(%) — 룰 값
  limitApplied: boolean             // 한도액으로 상한이 제한됐는지
  limitAmount: number | null        // 적용 구간의 한도액 (원) — 룰에 없으면 null
  vatRatePercent: number            // 부가가치세율(%) — 룰 값
  vatAmount: number                 // 상한액 기준 부가가치세 (원, 별도)
  appliedRules: AppliedRuleInfo[]
  ruleMode: TaxRuleMode
  containsProposedRule: boolean
}

export type BrokerageResult = BrokerageSuccess | TaxEngineFailure
