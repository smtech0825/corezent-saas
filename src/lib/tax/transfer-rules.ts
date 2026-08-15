/**
 * @파일: lib/tax/transfer-rules.ts
 * @설명: 양도소득세 룰 키와 rule_value 런타임 검증기 — 엔진(transfer.ts)과 관리자 저장이
 *        같은 검증기를 공유한다(다른 세목과 같은 구조).
 *        ⚠️ 세율·공제율·구간·기준액·연수·날짜 숫자를 이 파일에 넣지 않는다 — 형식 검사만
 *        하고 값은 전부 rule_value(관리자 입력)에서 온다.
 *        0이 함정이 되는 필드(가산 포인트·공제율·기본공제액 등)는 0 저장을 거부한다 —
 *        중개수수료의 '상한 0원 차단'과 같은 취지.
 *        (rule-value.ts가 300줄을 크게 넘겨 양도세 검증기는 이 파일로 분리)
 */

import type { Json } from './types'
import type { TaxEngineFailure } from './engine-types'
import { engineFail, isValidDateString } from './rule-store'
import { checkRateSpec } from './rule-value'
import type {
  TransferBaseRatesValue,
  TransferBasicDeductionParsed,
  TransferBasicDeductionRow,
  TransferExemptionValue,
  TransferGraceRow,
  TransferHeavyRow,
  TransferHeavyValue,
  TransferLocalIncomeTaxValue,
  TransferLtsdCapValue,
  TransferLtsdGeneralParsed,
  TransferLtsdOneHouseValue,
  TransferLtsdRow,
  TransferPeriodRuleValue,
  TransferRateRow,
  TransferShortTermValue,
  TransferTemporaryTwoHouseValue,
} from './transfer-types'

/** 양도소득세 룰 키 — 식별자일 뿐이며 값은 관리자가 DB에 등록한다 */
export const TRANSFER_RULE_KEYS = {
  baseRates: 'transfer.base_rates',                  // 기본세율 (누진)
  shortTermRates: 'transfer.short_term_rates',       // 단기 보유 세율표
  heavy: 'transfer.heavy',                           // 다주택 중과 가산 + 경과조치
  ltsdGeneral: 'transfer.ltsd.general',              // 장기보유특별공제 작은 표
  ltsdOneHouse: 'transfer.ltsd.one_house',           // 장기보유특별공제 큰 표(보유분+거주분)
  ltsdCap: 'transfer.ltsd.cap',                      // 장기보유특별공제 물건별 한도 (개정안 — 없으면 한도 없음)
  basicDeduction: 'transfer.basic_deduction',        // 기본공제
  exemption: 'transfer.exemption',                   // 1세대 1주택 비과세 요건 + 고가주택 기준
  temporaryTwoHouse: 'transfer.temporary_two_house', // 일시적 2주택 요건
  localIncomeTax: 'transfer.local_income_tax',       // 지방소득세 (독립 세목 — 별도 세율표)
  periodRule: 'transfer.period_rule',                // 연수 계산 방식 (초일 산입 여부)
  rounding: 'transfer.rounding',                     // 단수 처리 (선택 — 취득세와 같은 형식)
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
 * 세율 0%가 저장되면 세액 0원이 정상 결과처럼 표시되므로 양도세 세율표에서는 거부한다
 * (checkRateSpec 자체는 취득세 농어촌특별세 0% 같은 정당한 0을 위해 0을 허용 — 손대지 않는다).
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

/** 세율 행 배열(TransferRateRow[]) 검사 */
function checkRateRows(rows: unknown, ruleKey: string, field: string): TaxEngineFailure | null {
  if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, `${field}가 비어 있지 않은 배열이 아닙니다.`)
  for (let i = 0; i < rows.length; i++) {
    const shape = checkRowShape(rows[i], `${field}[${i}]`)
    if (shape) return invalid(ruleKey, shape)
    const rate = (rows[i] as Record<string, unknown>).rate
    const reason = checkRateSpec(rate) ?? checkRatePositive(rate)
    if (reason) return invalid(ruleKey, `${field}[${i}].rate — ${reason}`)
  }
  return null
}

/** 중과 가산 행 배열 검사 — 가산 0%p는 거부(중과인데 가산 없음 함정 차단) */
function checkHeavyRows(rows: unknown, ruleKey: string, field: string): TaxEngineFailure | null {
  if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, `${field}가 비어 있지 않은 배열이 아닙니다.`)
  for (let i = 0; i < rows.length; i++) {
    const shape = checkRowShape(rows[i], `${field}[${i}]`)
    if (shape) return invalid(ruleKey, shape)
    const p = (rows[i] as Record<string, unknown>).addPercentPoints
    if (!isNum(p) || p <= 0) return invalid(ruleKey, `${field}[${i}].addPercentPoints가 0보다 큰 숫자(%p)가 아닙니다.`)
  }
  return null
}

/** 장기보유특별공제 행 배열 검사 — 공제율 0%는 거부(공제 없음은 행 미매칭으로 표현) */
function checkLtsdRows(rows: unknown, ruleKey: string, field: string): TaxEngineFailure | null {
  if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, `${field}가 비어 있지 않은 배열이 아닙니다.`)
  for (let i = 0; i < rows.length; i++) {
    const shape = checkRowShape(rows[i], `${field}[${i}]`)
    if (shape) return invalid(ruleKey, shape)
    const p = (rows[i] as Record<string, unknown>).deductPercent
    if (!isNum(p) || p <= 0) return invalid(ruleKey, `${field}[${i}].deductPercent가 0보다 큰 숫자(%)가 아닙니다.`)
  }
  return null
}

/** transfer.base_rates 검증 */
export function parseTransferBaseRates(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferBaseRatesValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const reason = checkRateSpec(value.rate) ?? checkRatePositive(value.rate)
  if (reason) return invalid(ruleKey, `rate — ${reason}`)
  return { ok: true, value: value as unknown as TransferBaseRatesValue }
}

/** transfer.short_term_rates 검증 */
export function parseTransferShortTerm(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferShortTermValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const err = checkRateRows(value.rows, ruleKey, 'rows')
  if (err) return err
  return { ok: true, value: { rows: value.rows as unknown as TransferRateRow[] } }
}

/** transfer.heavy 검증 — 중과 가산 행 + 경과조치(선택) */
export function parseTransferHeavy(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferHeavyValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const err = checkHeavyRows(value.rows, ruleKey, 'rows')
  if (err) return err
  let grace: TransferHeavyValue['grace']
  if (value.grace !== undefined) {
    const g = value.grace
    if (!isObj(g)) return invalid(ruleKey, 'grace가 객체가 아닙니다.')
    if (typeof g.contractDeadline !== 'string' || !isValidDateString(g.contractDeadline)) {
      return invalid(ruleKey, 'grace.contractDeadline이 YYYY-MM-DD 날짜가 아닙니다.')
    }
    if (!Array.isArray(g.rows) || g.rows.length === 0) return invalid(ruleKey, 'grace.rows가 비어 있지 않은 배열이 아닙니다.')
    for (let i = 0; i < g.rows.length; i++) {
      const shape = checkRowShape(g.rows[i], `grace.rows[${i}]`)
      if (shape) return invalid(ruleKey, shape)
      const m = (g.rows[i] as Record<string, unknown>).monthsFromContract
      if (!isNum(m) || m <= 0 || !Number.isInteger(m)) {
        return invalid(ruleKey, `grace.rows[${i}].monthsFromContract가 0보다 큰 정수(개월)가 아닙니다.`)
      }
    }
    if (g.finalDeadline !== undefined && (typeof g.finalDeadline !== 'string' || !isValidDateString(g.finalDeadline))) {
      return invalid(ruleKey, 'grace.finalDeadline이 YYYY-MM-DD 날짜가 아닙니다.')
    }
    grace = {
      contractDeadline: g.contractDeadline,
      rows: g.rows as unknown as TransferGraceRow[],
      finalDeadline: g.finalDeadline as string | undefined,
    }
  }
  return { ok: true, value: { rows: value.rows as unknown as TransferHeavyRow[], grace } }
}

/**
 * transfer.ltsd.general 검증 — 구/신 형식을 판별해 반환한다(혼합 금지).
 * 구 형식: { rows } 보유 연수 단일 표. 신 형식: { holdingRows, residenceRows } —
 * 보유분·거주분 중 높은 쪽 하나. 확정법 룰은 재등록 없이 구 형식 그대로 동작한다.
 */
export function parseTransferLtsdGeneral(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferLtsdGeneralParsed } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const hasNew = value.holdingRows !== undefined || value.residenceRows !== undefined
  const hasOld = value.rows !== undefined
  if (hasNew && hasOld) {
    return invalid(ruleKey, '구 형식(rows)과 신 형식(holdingRows·residenceRows)을 한 룰에 섞을 수 없습니다.')
  }
  if (hasNew) {
    // residenceRows는 신 형식의 필수 필드 — 보유 기준만 있는 표는 구 형식(rows)으로 등록한다
    if (value.residenceRows === undefined) {
      return invalid(ruleKey, '신 형식에는 residenceRows(거주 기준 표)가 필요합니다. 보유 기준만 있는 표는 구 형식(rows)으로 등록하세요.')
    }
    const resErr = checkLtsdRows(value.residenceRows, ruleKey, 'residenceRows')
    if (resErr) return resErr
    // holdingRows 생략 = 보유 기준 공제 폐지(빈 배열·0% 행이 아니라 필드 생략으로 표현)
    if (value.holdingRows !== undefined) {
      const holdErr = checkLtsdRows(value.holdingRows, ruleKey, 'holdingRows')
      if (holdErr) return holdErr
    }
    return {
      ok: true,
      value: {
        format: 'max_residence',
        holdingRows: value.holdingRows as unknown as TransferLtsdRow[] | undefined,
        residenceRows: value.residenceRows as unknown as TransferLtsdRow[],
      },
    }
  }
  const err = checkLtsdRows(value.rows, ruleKey, 'rows')
  if (err) return err
  return { ok: true, value: { format: 'holding_only', rows: value.rows as unknown as TransferLtsdRow[] } }
}

/** transfer.ltsd.cap 검증 — 물건별 한도(원). 0 이하는 공제 0원 함정이라 거부 */
export function parseTransferLtsdCap(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferLtsdCapValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (!isNum(value.perPropertyAmount) || value.perPropertyAmount <= 0) {
    return invalid(ruleKey, 'perPropertyAmount(물건별 한도·원)가 0보다 큰 숫자가 아닙니다.')
  }
  return { ok: true, value: { perPropertyAmount: value.perPropertyAmount } }
}

/**
 * transfer.ltsd.one_house 검증 — 보유분·거주분 표 + 거주 요건 연수.
 * holdingRows 생략 = 그 시행기간의 보유 기준 공제 폐지(빈 배열·0% 행은 여전히 거부 —
 * 폐지는 필드 생략으로만 표현한다). 거주분은 필수.
 */
export function parseTransferLtsdOneHouse(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferLtsdOneHouseValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (!isNum(value.minResidenceYears) || value.minResidenceYears <= 0) {
    return invalid(ruleKey, 'minResidenceYears가 0보다 큰 숫자(년)가 아닙니다.')
  }
  if (value.holdingRows !== undefined) {
    const holdErr = checkLtsdRows(value.holdingRows, ruleKey, 'holdingRows')
    if (holdErr) return holdErr
  }
  const resErr = checkLtsdRows(value.residenceRows, ruleKey, 'residenceRows')
  if (resErr) return resErr
  return {
    ok: true,
    value: {
      minResidenceYears: value.minResidenceYears,
      holdingRows: value.holdingRows as unknown as TransferLtsdRow[] | undefined,
      residenceRows: value.residenceRows as unknown as TransferLtsdRow[],
    },
  }
}

/**
 * transfer.basic_deduction 검증 — 구/신 형식을 판별해 반환한다(혼합 금지).
 * 구 형식: { amount } 고정 금액 — 0원 거부(필수 룰이므로 양수 강제).
 * 신 형식: { rows } — 행 조건(거주기간·양도가액 등)별 금액, 각 행 0원 거부.
 * 확정법 룰은 재등록 없이 구 형식 그대로 동작한다.
 */
export function parseTransferBasicDeduction(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferBasicDeductionParsed } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const hasRows = value.rows !== undefined
  const hasFixed = value.amount !== undefined
  if (hasRows && hasFixed) {
    return invalid(ruleKey, '구 형식(amount 단일)과 신 형식(rows)을 한 룰에 섞을 수 없습니다.')
  }
  if (hasRows) {
    const rows = value.rows
    if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, 'rows가 비어 있지 않은 배열이 아닙니다.')
    for (let i = 0; i < rows.length; i++) {
      const shape = checkRowShape(rows[i], `rows[${i}]`)
      if (shape) return invalid(ruleKey, shape)
      const amount = (rows[i] as Record<string, unknown>).amount
      if (!isNum(amount) || amount <= 0) return invalid(ruleKey, `rows[${i}].amount가 0보다 큰 숫자(원)가 아닙니다.`)
    }
    return { ok: true, value: { format: 'rows', rows: rows as unknown as TransferBasicDeductionRow[] } }
  }
  if (!isNum(value.amount) || value.amount <= 0) return invalid(ruleKey, 'amount가 0보다 큰 숫자(원)가 아닙니다.')
  return { ok: true, value: { format: 'fixed', amount: value.amount } }
}

/** transfer.exemption 검증 */
export function parseTransferExemption(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferExemptionValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (!isNum(value.minHoldingYears) || value.minHoldingYears <= 0) {
    return invalid(ruleKey, 'minHoldingYears가 0보다 큰 숫자(년)가 아닙니다.')
  }
  const res = value.residenceIfAcquiredRegulated
  if (!isObj(res) || !isNum(res.minYears) || res.minYears <= 0) {
    return invalid(ruleKey, 'residenceIfAcquiredRegulated.minYears가 0보다 큰 숫자(년)가 아닙니다.')
  }
  if (!isNum(value.highPriceThreshold) || value.highPriceThreshold <= 0) {
    return invalid(ruleKey, 'highPriceThreshold가 0보다 큰 숫자(원)가 아닙니다.')
  }
  return {
    ok: true,
    value: {
      minHoldingYears: value.minHoldingYears,
      residenceIfAcquiredRegulated: { minYears: res.minYears },
      highPriceThreshold: value.highPriceThreshold,
    },
  }
}

/** transfer.temporary_two_house 검증 */
export function parseTransferTemporaryTwoHouse(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferTemporaryTwoHouseValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (!isNum(value.maxYearsFromNewAcquisition) || value.maxYearsFromNewAcquisition <= 0) {
    return invalid(ruleKey, 'maxYearsFromNewAcquisition이 0보다 큰 숫자(년)가 아닙니다.')
  }
  return { ok: true, value: { maxYearsFromNewAcquisition: value.maxYearsFromNewAcquisition } }
}

/** transfer.local_income_tax 검증 — 기본 세율표 + 단기·중과 대응(선택) */
export function parseTransferLocalIncomeTax(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferLocalIncomeTaxValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const reason = checkRateSpec(value.rate) ?? checkRatePositive(value.rate)
  if (reason) return invalid(ruleKey, `rate — ${reason}`)
  let shortTerm: TransferLocalIncomeTaxValue['shortTerm']
  if (value.shortTerm !== undefined) {
    const s = value.shortTerm
    if (!isObj(s)) return invalid(ruleKey, 'shortTerm이 객체가 아닙니다.')
    const err = checkRateRows(s.rows, ruleKey, 'shortTerm.rows')
    if (err) return err
    shortTerm = { rows: s.rows as unknown as TransferRateRow[] }
  }
  let heavyRows: TransferHeavyRow[] | undefined
  if (value.heavyRows !== undefined) {
    const err = checkHeavyRows(value.heavyRows, ruleKey, 'heavyRows')
    if (err) return err
    heavyRows = value.heavyRows as unknown as TransferHeavyRow[]
  }
  return { ok: true, value: { rate: value.rate as TransferLocalIncomeTaxValue['rate'], shortTerm, heavyRows } }
}

/** transfer.period_rule 검증 — 초일 산입 방식 */
export function parseTransferPeriodRule(
  value: Json,
  ruleKey: string,
): { ok: true; value: TransferPeriodRuleValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (value.dayInclusion !== 'include_start' && value.dayInclusion !== 'exclude_start') {
    return invalid(ruleKey, "dayInclusion은 'include_start'(초일 산입) 또는 'exclude_start'(초일 불산입)여야 합니다.")
  }
  return { ok: true, value: { dayInclusion: value.dayInclusion } }
}
