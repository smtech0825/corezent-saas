/**
 * @파일: lib/tax/property-rules.ts
 * @설명: 재산세(주택분) 룰 키와 rule_value 런타임 검증기 — 엔진(property.ts)과 관리자
 *        저장이 같은 검증기를 공유한다(양도세 transfer-rules.ts와 같은 구조).
 *        ⚠️ 세율·비율·구간·금액·월·일 숫자를 이 파일에 넣지 않는다 — 형식 검사만 하고
 *        값은 전부 rule_value(관리자 입력)에서 온다. 월 1~12·일 1~31 같은 범위 검사는
 *        달력 상수(승인 예외)다.
 *        0이 함정이 되는 필드(비율·세율·상한 비율)는 0 저장을 거부한다 — 세액 0원이
 *        정상 결과처럼 보이는 것을 막는 기존 계산기들과 같은 취지.
 */

import type { Json } from './types'
import type { TaxEngineFailure } from './engine-types'
import { engineFail } from './rule-store'
import { checkRateSpec } from './rule-value'
import type {
  PropertyAssessmentDateValue,
  PropertyAssessmentRatioOneHouseValue,
  PropertyAssessmentRatioValue,
  PropertyBaseCapValue,
  PropertyBurdenCapRow,
  PropertyBurdenCapValue,
  PropertyRatesValue,
  PropertyRatioRow,
  PropertySurtaxValue,
} from './property-types'

/** 재산세 룰 키 — 식별자일 뿐이며 값은 관리자가 DB에 등록한다 */
export const PROPERTY_RULE_KEYS = {
  assessmentRatio: 'property.assessment_ratio',                    // 일반 공정시장가액비율
  assessmentRatioOneHouse: 'property.assessment_ratio.one_house',  // 1세대 1주택 특례 비율(한시 — 종료일 필수)
  rates: 'property.rates',                                         // 세율표 (일반 + 1주택 특례)
  surtax: 'property.surtax',                                       // 지방교육세·도시지역분
  baseCap: 'property.base_cap',                                    // 과세표준 상한
  burdenCap: 'property.burden_cap',                                // 세부담 상한 (경과조치 — 시행기간으로 표현)
  assessmentDate: 'property.assessment_date',                      // 과세기준일 (월·일)
  rounding: 'property.rounding',                                   // 단수 처리 (선택 — 취득세와 같은 형식)
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
 * 재산세 본세·지방교육세·도시지역분 세율 0%가 저장되면 세액 0원이 정상 결과처럼
 * 보이므로 거부한다 (transfer-rules.ts의 동일 검사 — 파일 분리로 인한 소형 중복).
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

/** 공정시장가액비율(%) 값 검사 — 0 이하·100 초과는 명백한 입력 오류라 거부 */
function checkRatioPercent(v: unknown, label: string): string | null {
  if (!isNum(v) || v <= 0) return `${label}가 0보다 큰 숫자(%)가 아닙니다. 비율 0%는 과세표준 0원 함정이라 등록할 수 없습니다.`
  if (v > 100) return `${label}가 100을 넘습니다 — 공정시장가액비율은 100% 이하여야 합니다.`
  return null
}

/** property.assessment_ratio 검증 — 일반 비율 */
export function parsePropertyAssessmentRatio(
  value: Json,
  ruleKey: string,
): { ok: true; value: PropertyAssessmentRatioValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const reason = checkRatioPercent(value.ratioPercent, 'ratioPercent')
  if (reason) return invalid(ruleKey, reason)
  return { ok: true, value: { ratioPercent: value.ratioPercent as number } }
}

/** property.assessment_ratio.one_house 검증 — 1세대 1주택 특례 비율(구간별) */
export function parsePropertyAssessmentRatioOneHouse(
  value: Json,
  ruleKey: string,
): { ok: true; value: PropertyAssessmentRatioOneHouseValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const rows = value.rows
  if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, 'rows가 비어 있지 않은 배열이 아닙니다.')
  for (let i = 0; i < rows.length; i++) {
    const shape = checkRowShape(rows[i], `rows[${i}]`)
    if (shape) return invalid(ruleKey, shape)
    const reason = checkRatioPercent((rows[i] as Record<string, unknown>).ratioPercent, `rows[${i}].ratioPercent`)
    if (reason) return invalid(ruleKey, reason)
  }
  return { ok: true, value: { rows: rows as unknown as PropertyRatioRow[] } }
}

/** property.rates 검증 — 일반 세율표 + 1세대 1주택 특례세율표(선택) */
export function parsePropertyRates(
  value: Json,
  ruleKey: string,
): { ok: true; value: PropertyRatesValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const generalReason = checkRateSpec(value.general) ?? checkRatePositive(value.general)
  if (generalReason) return invalid(ruleKey, `general — ${generalReason}`)
  let oneHouse: PropertyRatesValue['oneHouse']
  if (value.oneHouse !== undefined) {
    const o = value.oneHouse
    if (!isObj(o)) return invalid(ruleKey, 'oneHouse가 객체가 아닙니다.')
    if (!isNum(o.maxOfficialPrice) || o.maxOfficialPrice <= 0) {
      return invalid(ruleKey, 'oneHouse.maxOfficialPrice가 0보다 큰 숫자(원)가 아닙니다.')
    }
    const rateReason = checkRateSpec(o.rate) ?? checkRatePositive(o.rate)
    if (rateReason) return invalid(ruleKey, `oneHouse.rate — ${rateReason}`)
    oneHouse = { maxOfficialPrice: o.maxOfficialPrice, rate: o.rate as PropertyRatesValue['general'] }
  }
  return { ok: true, value: { general: value.general as PropertyRatesValue['general'], oneHouse } }
}

/** property.surtax 검증 — 지방교육세(본세 기준)·도시지역분(과세표준 기준) */
export function parsePropertySurtax(
  value: Json,
  ruleKey: string,
): { ok: true; value: PropertySurtaxValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const eduReason = checkRateSpec(value.localEducation) ?? checkRatePositive(value.localEducation)
  if (eduReason) return invalid(ruleKey, `localEducation — ${eduReason}`)
  const urbanReason = checkRateSpec(value.urbanArea) ?? checkRatePositive(value.urbanArea)
  if (urbanReason) return invalid(ruleKey, `urbanArea — ${urbanReason}`)
  return {
    ok: true,
    value: {
      localEducation: value.localEducation as PropertySurtaxValue['localEducation'],
      urbanArea: value.urbanArea as PropertySurtaxValue['urbanArea'],
    },
  }
}

/** property.base_cap 검증 — 상한 증가율과 그 기준(당해/직전 과세표준) */
export function parsePropertyBaseCap(
  value: Json,
  ruleKey: string,
): { ok: true; value: PropertyBaseCapValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  // 증가율 0%는 법령상 허용 범위에 있을 수 있어(상한율 하한) 거부하지 않는다 — 음수만 거부
  if (!isNum(value.increasePercent) || value.increasePercent < 0) {
    return invalid(ruleKey, 'increasePercent가 0 이상 숫자(%)가 아닙니다.')
  }
  if (value.increaseBasis !== 'current_base' && value.increaseBasis !== 'previous_base') {
    return invalid(ruleKey, "increaseBasis는 'current_base'(당해 과세표준 기준) 또는 'previous_base'(직전 과세표준 기준)여야 합니다.")
  }
  return { ok: true, value: { increasePercent: value.increasePercent, increaseBasis: value.increaseBasis } }
}

/** property.burden_cap 검증 — 공시가격 구간별 상한 비율. 0%는 세액 0원 함정이라 거부 */
export function parsePropertyBurdenCap(
  value: Json,
  ruleKey: string,
): { ok: true; value: PropertyBurdenCapValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const rows = value.rows
  if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, 'rows가 비어 있지 않은 배열이 아닙니다.')
  for (let i = 0; i < rows.length; i++) {
    const shape = checkRowShape(rows[i], `rows[${i}]`)
    if (shape) return invalid(ruleKey, shape)
    const p = (rows[i] as Record<string, unknown>).capPercent
    if (!isNum(p) || p <= 0) {
      return invalid(ruleKey, `rows[${i}].capPercent가 0보다 큰 숫자(%)가 아닙니다. 상한 비율 0%는 세액 0원 함정이라 등록할 수 없습니다.`)
    }
  }
  return { ok: true, value: { rows: rows as unknown as PropertyBurdenCapRow[] } }
}

/** property.assessment_date 검증 — 월(1~12)·일(1~31)은 달력 상수 범위 검사다 */
export function parsePropertyAssessmentDate(
  value: Json,
  ruleKey: string,
): { ok: true; value: PropertyAssessmentDateValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (!isNum(value.month) || !Number.isInteger(value.month) || value.month < 1 || value.month > 12) {
    return invalid(ruleKey, 'month는 1~12 사이 정수여야 합니다.')
  }
  if (!isNum(value.day) || !Number.isInteger(value.day) || value.day < 1 || value.day > 31) {
    return invalid(ruleKey, 'day는 1~31 사이 정수여야 합니다.')
  }
  return { ok: true, value: { month: value.month, day: value.day } }
}
