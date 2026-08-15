/**
 * @파일: lib/tax/comprehensive-rules.ts
 * @설명: 종합부동산세 룰 키와 rule_value 런타임 검증기 — 엔진(comprehensive.ts)과 관리자
 *        저장이 같은 검증기를 공유한다(다른 세목과 같은 구조).
 *        ⚠️ 세율·비율·공제액·구간·한도 숫자를 이 파일에 넣지 않는다 — 형식 검사만 하고
 *        값은 전부 rule_value(관리자 입력)에서 온다.
 *        구조가 재산세와 완전히 같은 룰(공정시장가액비율·과세기준일·세부담 상한 표)은
 *        property-rules.ts의 검증기를 그대로 공유한다 — 같은 검사를 두 벌 두지 않는다.
 */

import type { Json } from './types'
import type { TaxEngineFailure } from './engine-types'
import { engineFail } from './rule-store'
import { checkRateSpec } from './rule-value'
import { checkAmountSpec } from './amount-spec'
import { parsePropertyAssessmentRatio, parsePropertyAssessmentRatioOneHouse } from './property-rules'
import type {
  ComprehensiveAssessmentRatioParsed,
  ComprehensiveBasicDeductionParsed,
  ComprehensiveBasicDeductionRow,
  ComprehensiveCreditRow,
  ComprehensiveRateRow,
  ComprehensiveRatesValue,
  ComprehensiveRuralSurtaxValue,
  ComprehensiveTaxCreditParsed,
} from './comprehensive-types'

/** 종합부동산세 룰 키 — 식별자일 뿐이며 값은 관리자가 DB에 등록한다 */
export const COMPREHENSIVE_RULE_KEYS = {
  basicDeduction: 'comprehensive.basic_deduction',    // 기본공제 (1세대 1주택 / 그 외)
  assessmentRatio: 'comprehensive.assessment_ratio',  // 공정시장가액비율 (재산세와 같은 형식)
  rates: 'comprehensive.rates',                       // 세율표 (일반/중과 행 혼합 — heavy 표시)
  taxCredit: 'comprehensive.tax_credit',              // 1세대 1주택 연령·보유 세액공제 + 합산 한도
  burdenCap: 'comprehensive.burden_cap',              // 세부담 상한 (재산세와 같은 형식)
  ruralSurtax: 'comprehensive.rural_surtax',          // 농어촌특별세
  assessmentDate: 'comprehensive.assessment_date',    // 과세기준일 (월·일 — 재산세와 같은 형식)
  rounding: 'comprehensive.rounding',                 // 단수 처리 (선택 — 취득세와 같은 형식)
} as const

/** 유한한 숫자인지 검사 (rule-value.ts와 동일 — 파일 분리로 인한 소형 중복) */
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 순수 객체(배열 제외)인지 검사 (rule-value.ts와 동일 — 파일 분리로 인한 소형 중복) */
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** rule_value 구조 오류 실패 생성 */
function invalid(ruleKey: string, detail: string): TaxEngineFailure {
  return engineFail(
    'RULE_VALUE_INVALID',
    `룰('${ruleKey}')의 값 구조가 올바르지 않습니다: ${detail} 관리자 화면에서 룰 값을 수정해 주세요.`,
    ruleKey,
  )
}

/**
 * 세율 명세의 세율이 전부 0보다 큰지 검사 — 통과하면 null, 실패하면 사유.
 * 세율 0%는 세액 0원이 정상 결과처럼 보이는 함정이라 거부한다
 * (transfer-rules.ts의 동일 검사 — 파일 분리로 인한 소형 중복).
 */
function checkRatePositive(spec: unknown): string | null {
  if (!isObj(spec)) return null   // 구조 오류는 checkRateSpec이 먼저 잡는다
  if (spec.type === 'fixed' && typeof spec.ratePercent === 'number' && spec.ratePercent <= 0) {
    return '세율 0% 이하는 등록할 수 없습니다(세액 0원이 정상 결과처럼 보이는 것을 막기 위해서입니다).'
  }
  if (spec.type === 'progressive' && Array.isArray(spec.brackets)) {
    for (let i = 0; i < spec.brackets.length; i++) {
      const b = spec.brackets[i] as Record<string, unknown>
      if (typeof b?.ratePercent === 'number' && b.ratePercent <= 0) {
        return `brackets[${i}]의 세율이 0% 이하입니다 — 누진 구간의 세율은 전부 0보다 커야 합니다.`
      }
    }
  }
  return null
}

/** 행 공통(when·priority) 검사 — 통과하면 null, 실패하면 사유 */
function checkRowShape(row: unknown, label: string): string | null {
  if (!isObj(row)) return `${label}가 객체가 아닙니다.`
  if (!isObj(row.when)) return `${label}.when이 객체가 아닙니다.`
  if (row.priority !== undefined && !isNum(row.priority)) return `${label}.priority가 숫자가 아닙니다.`
  return null
}

/**
 * comprehensive.basic_deduction 검증 — 구/신 형식을 판별해 반환한다(혼합 금지).
 * 구 형식: 두 기준 모두 0원 거부(공제 0원 함정 차단).
 * 신 형식(rows): 행 조건 + AmountSpec(고정 또는 기준액+가산액×비중 산식) + 선택 라벨.
 * 확정법 룰은 재등록 없이 구 형식 그대로 동작해야 한다 — 구 형식 검사를 바꾸지 않는다.
 */
export function parseComprehensiveBasicDeduction(
  value: Json,
  ruleKey: string,
): { ok: true; value: ComprehensiveBasicDeductionParsed } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const hasRows = value.rows !== undefined
  const hasFixedPair = value.generalAmount !== undefined || value.oneHouseAmount !== undefined
  if (hasRows && hasFixedPair) {
    return invalid(ruleKey, '구 형식(generalAmount·oneHouseAmount)과 신 형식(rows)을 한 룰에 섞을 수 없습니다.')
  }
  if (hasRows) {
    const rows = value.rows
    if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, 'rows가 비어 있지 않은 배열이 아닙니다.')
    for (let i = 0; i < rows.length; i++) {
      const shape = checkRowShape(rows[i], `rows[${i}]`)
      if (shape) return invalid(ruleKey, shape)
      const row = rows[i] as Record<string, unknown>
      const reason = checkAmountSpec(row.deduction)
      if (reason) return invalid(ruleKey, `rows[${i}].deduction — ${reason}`)
      if (row.label !== undefined && (typeof row.label !== 'string' || row.label.trim() === '')) {
        return invalid(ruleKey, `rows[${i}].label은 비어 있지 않은 문자열이어야 합니다(화면 표시용 라벨).`)
      }
    }
    return { ok: true, value: { format: 'rows', rows: rows as unknown as ComprehensiveBasicDeductionRow[] } }
  }
  if (!isNum(value.generalAmount) || value.generalAmount <= 0) {
    return invalid(ruleKey, 'generalAmount가 0보다 큰 숫자(원)가 아닙니다.')
  }
  if (!isNum(value.oneHouseAmount) || value.oneHouseAmount <= 0) {
    return invalid(ruleKey, 'oneHouseAmount가 0보다 큰 숫자(원)가 아닙니다.')
  }
  return {
    ok: true,
    value: { format: 'fixed_pair', generalAmount: value.generalAmount, oneHouseAmount: value.oneHouseAmount },
  }
}

/**
 * comprehensive.assessment_ratio 검증 — 구/신 형식을 판별해 반환한다(혼합 금지).
 * 구 형식: { ratioPercent } 단일 — 재산세 일반 비율 검증기 공유.
 * 신 형식: { rows: [{ when, ratioPercent }] } — 재산세 1주택 특례 비율과 같은 행 구조라
 * 그 검증기를 공유한다(주택 수·조정대상지역 보유 등 조건은 엔진 컨텍스트가 판정).
 */
export function parseComprehensiveAssessmentRatio(
  value: Json,
  ruleKey: string,
): { ok: true; value: ComprehensiveAssessmentRatioParsed } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (value.rows !== undefined) {
    if (value.ratioPercent !== undefined) {
      return invalid(ruleKey, '구 형식(ratioPercent 단일)과 신 형식(rows)을 한 룰에 섞을 수 없습니다.')
    }
    const parsed = parsePropertyAssessmentRatioOneHouse(value, ruleKey)
    if (!parsed.ok) return parsed
    return { ok: true, value: { format: 'rows', rows: parsed.value.rows } }
  }
  const single = parsePropertyAssessmentRatio(value, ruleKey)
  if (!single.ok) return single
  return { ok: true, value: { format: 'single', ratioPercent: single.value.ratioPercent } }
}

/** comprehensive.rates 검증 — heavy 표시는 boolean만 허용 */
export function parseComprehensiveRates(
  value: Json,
  ruleKey: string,
): { ok: true; value: ComprehensiveRatesValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const rows = value.rows
  if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, 'rows가 비어 있지 않은 배열이 아닙니다.')
  for (let i = 0; i < rows.length; i++) {
    const shape = checkRowShape(rows[i], `rows[${i}]`)
    if (shape) return invalid(ruleKey, shape)
    const row = rows[i] as Record<string, unknown>
    const reason = checkRateSpec(row.rate) ?? checkRatePositive(row.rate)
    if (reason) return invalid(ruleKey, `rows[${i}].rate — ${reason}`)
    if (row.heavy !== undefined && typeof row.heavy !== 'boolean') {
      return invalid(ruleKey, `rows[${i}].heavy는 true/false여야 합니다(중과 세율표 행 표시).`)
    }
  }
  return { ok: true, value: { rows: rows as unknown as ComprehensiveRateRow[] } }
}

/** 세액공제 행 배열 검사 — 공제율 0%는 거부(공제 없음은 행 미매칭으로 표현) */
function checkCreditRows(rows: unknown, ruleKey: string, field: string): TaxEngineFailure | null {
  if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, `${field}가 비어 있지 않은 배열이 아닙니다.`)
  for (let i = 0; i < rows.length; i++) {
    const shape = checkRowShape(rows[i], `${field}[${i}]`)
    if (shape) return invalid(ruleKey, shape)
    const p = (rows[i] as Record<string, unknown>).creditPercent
    if (!isNum(p) || p <= 0) return invalid(ruleKey, `${field}[${i}].creditPercent가 0보다 큰 숫자(%)가 아닙니다.`)
  }
  return null
}

/**
 * comprehensive.tax_credit 검증 — 구/신 형식을 판별해 반환한다.
 * 구 형식: { ageRows, holdingRows, maxTotalPercent } — 연령분·보유분 합산 + % 한도.
 * 신 형식: { ageRows, holdingRows?, residenceRows, maxTotalPercent, maxAmount } —
 * 연령분 합산(좌동) + 보유분·거주분 중 높은 쪽 + % 한도(좌동) + 금액 한도(신설).
 * residenceRows·maxAmount의 존재가 신 형식의 판별 기준이며(둘 다 필수), 신 형식의
 * holdingRows 생략 = 보유 기준 공제 폐지(빈 배열·0% 행은 여전히 거부).
 */
export function parseComprehensiveTaxCredit(
  value: Json,
  ruleKey: string,
): { ok: true; value: ComprehensiveTaxCreditParsed } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const ageErr = checkCreditRows(value.ageRows, ruleKey, 'ageRows')
  if (ageErr) return ageErr
  const isNew = value.residenceRows !== undefined || value.maxAmount !== undefined
  if (isNew) {
    if (value.residenceRows === undefined) {
      return invalid(ruleKey, '신 형식에는 residenceRows(거주 기준 표)가 필요합니다.')
    }
    const resErr = checkCreditRows(value.residenceRows, ruleKey, 'residenceRows')
    if (resErr) return resErr
    // holdingRows 생략 = 보유 기준 공제 폐지 — 있으면 구 형식과 같은 검사를 통과해야 한다
    if (value.holdingRows !== undefined) {
      const holdErr = checkCreditRows(value.holdingRows, ruleKey, 'holdingRows')
      if (holdErr) return holdErr
    }
    if (!isNum(value.maxTotalPercent) || value.maxTotalPercent <= 0 || value.maxTotalPercent > 100) {
      return invalid(ruleKey, 'maxTotalPercent(합산 한도)가 0보다 크고 100 이하인 숫자(%)가 아닙니다.')
    }
    if (!isNum(value.maxAmount) || value.maxAmount <= 0) {
      return invalid(ruleKey, 'maxAmount(공제액 한도·원)가 0보다 큰 숫자가 아닙니다.')
    }
    return {
      ok: true,
      value: {
        format: 'age_plus_max',
        ageRows: value.ageRows as unknown as ComprehensiveCreditRow[],
        holdingRows: value.holdingRows as unknown as ComprehensiveCreditRow[] | undefined,
        residenceRows: value.residenceRows as unknown as ComprehensiveCreditRow[],
        maxTotalPercent: value.maxTotalPercent,
        maxAmount: value.maxAmount,
      },
    }
  }
  const holdErr = checkCreditRows(value.holdingRows, ruleKey, 'holdingRows')
  if (holdErr) return holdErr
  if (!isNum(value.maxTotalPercent) || value.maxTotalPercent <= 0 || value.maxTotalPercent > 100) {
    return invalid(ruleKey, 'maxTotalPercent가 0보다 크고 100 이하인 숫자(%)가 아닙니다.')
  }
  return {
    ok: true,
    value: {
      format: 'sum_holding',
      ageRows: value.ageRows as unknown as ComprehensiveCreditRow[],
      holdingRows: value.holdingRows as unknown as ComprehensiveCreditRow[],
      maxTotalPercent: value.maxTotalPercent,
    },
  }
}

/** comprehensive.rural_surtax 검증 — 0%는 농특세 0원 함정이라 거부 */
export function parseComprehensiveRuralSurtax(
  value: Json,
  ruleKey: string,
): { ok: true; value: ComprehensiveRuralSurtaxValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (!isNum(value.ratePercent) || value.ratePercent <= 0) {
    return invalid(ruleKey, 'ratePercent가 0보다 큰 숫자(%)가 아닙니다.')
  }
  return { ok: true, value: { ratePercent: value.ratePercent } }
}

// comprehensive.assessment_ratio → parseComprehensiveAssessmentRatio (이 파일 — 구/신 형식 판별,
//                                   내부에서 재산세 검증기 2종을 형식별로 공유)
// comprehensive.assessment_date  → parsePropertyAssessmentDate (property-rules.ts)
// comprehensive.burden_cap       → parsePropertyBurdenCap (property-rules.ts)
// comprehensive.rounding         → parseRounding (rule-value.ts)
// — 구조가 완전히 같아 재산세·공용 검증기를 그대로 쓴다(엔진과 관리자 저장이 함께 참조).
