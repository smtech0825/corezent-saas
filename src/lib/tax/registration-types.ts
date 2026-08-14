/**
 * @파일: lib/tax/registration-types.ts
 * @설명: 등기비용(아파트 매매 소유권 이전) 엔진의 입력·결과·rule_value(jsonb) 스키마 타입.
 *        ⚠️ 수수료·매입률·구간·금액 등 실제 숫자는 이 파일에 절대 넣지 않는다 —
 *        구조(스키마)만 정의하고 값은 전부 DB(tax_rules)에서 읽는다.
 *        등기비용 = 취득세 + 인지세 + 등기신청 수수료 + 국민주택채권 손실액 + 법무사 보수.
 *        취득세·인지세는 기존 엔진을 호출해 구한다(재구현 금지 — 종부세의 재산세 호출 전례).
 *        채권 손실률(매일 변동)과 법무사 보수(자율 협의)는 룰이 아니라 사용자 입력이며,
 *        비우면 0이 아니라 '포함하지 않음'으로 구분해 담는다.
 */

import type { TaxRuleMode } from './types'
import type { AppliedRuleInfo, Conditions, RoundingValue, TaxEngineFailure } from './engine-types'

// ─── rule_value 스키마 (룰 키별) ─────────────────────────────────────────────

/**
 * registration.fee 행 — 신청 방법별 등기신청 수수료(정액).
 * 방법 구분(전자·서면 등)은 관리자가 methodLabel로 적고, 기본으로 쓸 행 하나에
 * default: true를 단다 — 코드는 어떤 방법도 정하지 않는다. 나머지 행은 결과에
 * '다른 방법' 참고 금액으로 함께 담겨 화면이 보여줄 수 있다.
 */
export interface RegistrationFeeRow {
  methodLabel: string    // 신청 방법 이름(관리자 입력 — 화면에 그대로 표시)
  amount: number         // 수수료(원, 정액) — 관리자 입력
  default?: boolean      // 기본 적용 행 — 전체에서 정확히 1개
}

/** rule_value: 등기신청 수수료 (registration.fee) */
export interface RegistrationFeeValue {
  rows: RegistrationFeeRow[]
}

/** registration.bond 행 — 국민주택채권 매입률(%). 조건은 official_price·sido 등 */
export interface RegistrationBondRow {
  when: Conditions
  priority?: number
  ratePercent: number    // 매입률(%) — 관리자 입력
}

/**
 * rule_value: 국민주택채권 매입률 (registration.bond).
 * 매입 의무액 = 시가표준액 × 매입률. rounding(선택)은 매입액의 단수 처리를 룰이 정한다
 * (미지정 시 1원 버림). 즉시매도 손실률은 매일 바뀌므로 룰에 담지 않고 사용자 입력이다.
 */
export interface RegistrationBondValue {
  rows: RegistrationBondRow[]
  rounding?: RoundingValue
}

// ─── 계산기 입력 ──────────────────────────────────────────────────────────────

/**
 * @타입: RegistrationInput
 * @설명: 등기비용 계산 입력(아파트 매매 한정 — 상속·증여·신축 등기는 범위 밖).
 *        취득세 계산에 필요한 항목은 취득세 엔진 입력(AcquisitionInput)으로 그대로
 *        전달된다. 개인식별정보(이름·이메일·IP)는 포함하지 않는다.
 */
export interface RegistrationInput {
  baseDate: string           // 취득일 = 계산 기준일 (YYYY-MM-DD)
  regionCode: string         // 소재지 행정구역 코드 — 취득세 조정대상지역 판정용
  sido?: string              // 소재지 시·도 이름 — 취득세 is_metro·채권 지역 조건용
  price: number              // 취득가액 (원) — 취득세·인지세의 기준 금액
  officialPrice: number      // 시가표준액(공시가격, 원) — 채권 매입액·취득세 저가주택 판정
  houseCountAfter: number    // 취득 후 1세대 주택 수
  areaSqm?: number           // 전용면적(㎡) — 취득세 농어촌특별세 판정
  firstHome?: boolean        // 생애최초 취득 — 취득세 감면 판정(값은 룰에 있음)
  temporaryTwoHome?: boolean // 일시적 2주택 — 취득세 중과 배제 판정
  bondLossPercent?: number   // 채권 즉시매도 손실률(%) — 매일 변동, 비우면 채권 항목 미포함
  judicialFee?: number       // 법무사 보수(원) — 자율 협의, 비우면 미포함
}

// ─── 계산 결과 ────────────────────────────────────────────────────────────────

/**
 * 선택 항목의 포함 상태 — '0원'과 '계산에 안 들어감'을 구분한다(이 구분이 이 계산기의 핵심).
 * not_included면 총액에 합산되지 않으며 화면이 "입력하면 포함됩니다"로 표시한다.
 */
export type RegistrationItemStatus =
  | { status: 'included'; amount: number }
  | { status: 'not_included'; reason: string }

/** 국민주택채권 상세 — 매입 의무액과 즉시매도 손실액을 함께 담는다(화면 표시용) */
export type RegistrationBondDetail =
  | {
      status: 'included'
      purchaseAmount: number   // 매입 의무액 (원) — 시가표준액 × 매입률(룰), 단수 처리 후
      ratePercent: number      // 적용 매입률(%) — 룰 값
      lossPercent: number      // 즉시매도 손실률(%) — 사용자 입력
      lossAmount: number       // 손실액 (원) — 총액에 들어가는 금액
    }
  | { status: 'not_included'; reason: string }

/** 항목별 금액 분해 — 필수 항목은 금액, 선택 항목은 포함 상태 구조 */
export interface RegistrationBreakdown {
  acquisitionTax: number       // 취득세 본세 (취득세 엔진 결과)
  localEducationTax: number    // 지방교육세 (취득세 엔진 결과)
  ruralSpecialTax: number      // 농어촌특별세 (취득세 엔진 결과)
  stampTax: number             // 인지세 (인지세 엔진 결과 — 비과세면 0 + 사유 별도)
  registrationFee: number      // 등기신청 수수료 (registration.fee 룰)
  bondLoss: RegistrationItemStatus     // 채권 즉시매도 손실액 — 손실률 미입력이면 미포함
  judicialFee: RegistrationItemStatus  // 법무사 보수 — 미입력이면 미포함
  total: number                // 포함된 항목만의 합
}

/**
 * @타입: RegistrationSuccess
 * @설명: 등기비용 계산 성공 결과. 어느 항목이 포함됐고 어느 항목이 빠졌는지,
 *        빠진 항목이 있으면 실제 지출이 총액보다 클 수 있다는 판정까지 담는다.
 */
export interface RegistrationSuccess {
  ok: true
  breakdown: RegistrationBreakdown
  /** 빠진 선택 항목이 하나라도 있는지 — 화면이 "실제 지출이 이보다 클 수 있음"을 표시 */
  someExcluded: boolean
  /** 등기신청 수수료 — 적용된 방법과 다른 방법의 참고 금액(룰의 나머지 행) */
  feeMethodLabel: string
  feeOtherMethods: { methodLabel: string; amount: number }[]
  /** 국민주택채권 상세 */
  bond: RegistrationBondDetail
  /** 인지세 비과세면 그 사유(인지세 엔진의 관리자 입력 문구) — 0원의 이유를 그대로 전달 */
  stampExempt: boolean
  stampExemptReason: string | null
  /** 취득세 판정 정보 — 조정대상지역 여부(취득세 엔진 결과 그대로) */
  isRegulatedArea: boolean
  appliedRules: AppliedRuleInfo[]      // 취득세·인지세·등기 룰 병합 (세목은 룰 키 접두사로 구분)
  ruleMode: TaxRuleMode
  containsProposedRule: boolean
  /** 값 미입력(미확정)으로 판정하지 못한 조건 — 취득세 엔진 것 포함 병합 */
  unresolvedFields: string[]
}

export type RegistrationResult = RegistrationSuccess | TaxEngineFailure
