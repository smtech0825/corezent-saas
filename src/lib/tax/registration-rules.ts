/**
 * @파일: lib/tax/registration-rules.ts
 * @설명: 등기비용 룰 키와 rule_value 런타임 검증기 — 엔진(registration.ts)과 관리자
 *        저장이 같은 검증기를 공유한다(다른 세목과 같은 구조).
 *        ⚠️ 수수료·매입률·구간 숫자를 이 파일에 넣지 않는다 — 형식 검사만 하고 값은
 *        전부 rule_value(관리자 입력)에서 온다. 0이 함정이 되는 값(수수료·매입률)은
 *        0 저장을 거부한다.
 *        법무사 보수는 자율 협의라 룰을 두지 않는다(사용자 입력 전용). 채권 즉시매도
 *        손실률도 매일 바뀌므로 룰에 담지 않는다 — 룰에는 매입률만 담는다.
 */

import type { Json } from './types'
import type { RoundingValue, TaxEngineFailure } from './engine-types'
import { engineFail } from './rule-store'
import type {
  RegistrationBondRow,
  RegistrationBondValue,
  RegistrationFeeRow,
  RegistrationFeeValue,
} from './registration-types'

/** 등기비용 룰 키 — 식별자일 뿐이며 값은 관리자가 DB에 등록한다 */
export const REGISTRATION_RULE_KEYS = {
  fee: 'registration.fee',    // 등기신청 수수료 (신청 방법별 정액 — default 행 1개)
  bond: 'registration.bond',  // 국민주택채권 매입률 (시가표준액·지역 조건별)
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
 * registration.fee 검증 — 신청 방법별 정액 수수료.
 * default: true 행이 정확히 1개여야 한다(코드가 방법을 정하지 않고 룰이 정하는 구조).
 * 수수료 0원은 비용 0원이 정상 결과처럼 보이는 함정이라 거부한다.
 */
export function parseRegistrationFee(
  value: Json,
  ruleKey: string,
): { ok: true; value: RegistrationFeeValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const rows = value.rows
  if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, 'rows가 비어 있지 않은 배열이 아닙니다.')
  let defaultCount = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!isObj(row)) return invalid(ruleKey, `rows[${i}]가 객체가 아닙니다.`)
    if (typeof row.methodLabel !== 'string' || row.methodLabel.trim() === '') {
      return invalid(ruleKey, `rows[${i}].methodLabel이 비어 있지 않은 문자열(신청 방법 이름)이 아닙니다.`)
    }
    if (!isNum(row.amount) || row.amount <= 0) {
      return invalid(ruleKey, `rows[${i}].amount가 0보다 큰 숫자(원)가 아닙니다. 수수료 0원은 등록할 수 없습니다.`)
    }
    if (row.default !== undefined && typeof row.default !== 'boolean') {
      return invalid(ruleKey, `rows[${i}].default는 true/false여야 합니다.`)
    }
    if (row.default === true) defaultCount++
  }
  if (defaultCount !== 1) {
    return invalid(ruleKey, `기본 적용 행("default": true)이 정확히 1개여야 합니다(현재 ${defaultCount}개). 엔진은 기본 행의 금액을 쓰고 나머지는 참고로 표시합니다.`)
  }
  return { ok: true, value: { rows: rows as unknown as RegistrationFeeRow[] } }
}

/**
 * registration.bond 검증 — 국민주택채권 매입률 표 + 매입액 단수 처리(선택).
 * 매입률 0%는 채권 항목이 조용히 0원이 되는 함정이라 거부한다. 매입 면제 구간은
 * "exempt": true 행으로 표현한다 — 그 행에는 ratePercent를 넣지 않으며(동시 존재는
 * 저장 거부), 엔진·화면은 0원이 아니라 '면제(매입 대상 아님)'로 처리한다.
 */
export function parseRegistrationBond(
  value: Json,
  ruleKey: string,
): { ok: true; value: RegistrationBondValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const rows = value.rows
  if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, 'rows가 비어 있지 않은 배열이 아닙니다.')
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!isObj(row)) return invalid(ruleKey, `rows[${i}]가 객체가 아닙니다.`)
    if (!isObj(row.when)) return invalid(ruleKey, `rows[${i}].when이 객체가 아닙니다.`)
    if (row.priority !== undefined && !isNum(row.priority)) return invalid(ruleKey, `rows[${i}].priority가 숫자가 아닙니다.`)
    if (row.exempt !== undefined && row.exempt !== true) {
      return invalid(ruleKey, `rows[${i}].exempt는 true만 허용합니다(면제가 아니면 필드를 빼세요).`)
    }
    if (row.exempt === true) {
      // 면제 행 — 매입률과 동시에 있으면 의미가 모순이라 저장 거부
      if (row.ratePercent !== undefined) {
        return invalid(ruleKey, `rows[${i}]는 면제 행("exempt": true)이므로 ratePercent를 함께 넣을 수 없습니다.`)
      }
    } else if (!isNum(row.ratePercent) || row.ratePercent <= 0) {
      return invalid(ruleKey, `rows[${i}].ratePercent가 0보다 큰 숫자(%)가 아닙니다. 매입률 0%는 등록할 수 없습니다 — 면제 구간은 "exempt": true 행으로 표현하세요.`)
    }
  }
  let rounding: RoundingValue | undefined
  if (value.rounding !== undefined) {
    const r = value.rounding
    if (!isObj(r)) return invalid(ruleKey, 'rounding이 객체가 아닙니다.')
    if (!isNum(r.unit) || r.unit < 1 || !Number.isInteger(r.unit)) {
      return invalid(ruleKey, 'rounding.unit이 1 이상 정수(원)가 아닙니다.')
    }
    if (r.method !== 'floor' && r.method !== 'round' && r.method !== 'ceil') {
      return invalid(ruleKey, "rounding.method는 'floor'·'round'·'ceil' 중 하나여야 합니다.")
    }
    rounding = { unit: r.unit, method: r.method }
  }
  return { ok: true, value: { rows: rows as unknown as RegistrationBondRow[], rounding } }
}
