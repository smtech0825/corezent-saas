/**
 * @파일: lib/tax/rule-value.ts
 * @설명: rule_value(jsonb) 런타임 검증·세율 평가·조건 매칭.
 *        관리자가 입력한 JSON이 스키마와 다르면 조용히 넘어가지 않고
 *        RULE_VALUE_INVALID로 계산을 중단한다(잘못된 룰로 계산하면 세액이 틀린다).
 *        ⚠️ 세율·공제·구간 숫자를 이 파일에 넣지 않는다 — 값은 전부 rule_value에서 온다.
 */

import type { Json } from './types'
import type {
  ConditionSpec,
  Conditions,
  DeemedGiftThresholdValue,
  GiftHeavyValue,
  GiftTaxBasis,
  GiftTaxBaseValue,
  MetroScopeValue,
  RateSpec,
  RateTableRow,
  RoundingValue,
  TaxEngineFailure,
} from './engine-types'
import { engineFail } from './rule-store'

/** 유한한 숫자인지 검사 */
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 순수 객체(배열 제외)인지 검사 */
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

// ─── RateSpec 검증·평가 ──────────────────────────────────────────────────────

/** RateSpec 구조 검증 — 통과하면 null, 실패하면 사유 문자열 */
function checkRateSpec(spec: unknown): string | null {
  if (!isObj(spec)) return '세율 명세가 객체가 아닙니다.'
  if (spec.type === 'fixed') {
    if (!isNum(spec.ratePercent) || spec.ratePercent < 0) return 'fixed 세율의 ratePercent가 0 이상 숫자가 아닙니다.'
    return null
  }
  if (spec.type === 'linear_by_base') {
    if (!isNum(spec.per) || spec.per <= 0) return 'linear_by_base의 per는 0보다 큰 숫자여야 합니다.'
    if (!isNum(spec.slopePercent) || !isNum(spec.interceptPercent)) return 'linear_by_base의 계수가 숫자가 아닙니다.'
    if (spec.minPercent !== undefined && !isNum(spec.minPercent)) return 'minPercent가 숫자가 아닙니다.'
    if (spec.maxPercent !== undefined && !isNum(spec.maxPercent)) return 'maxPercent가 숫자가 아닙니다.'
    if (spec.rounding !== undefined) {
      const r = spec.rounding
      if (!isObj(r)) return 'rounding이 객체가 아닙니다.'
      if (!isNum(r.decimals) || !Number.isInteger(r.decimals) || r.decimals < 0 || r.decimals > 10) {
        return 'rounding.decimals는 0~10 사이 정수여야 합니다.'
      }
      if (r.method !== 'round' && r.method !== 'floor' && r.method !== 'ceil') {
        return "rounding.method는 'round'·'floor'·'ceil' 중 하나여야 합니다."
      }
    }
    return null
  }
  return `알 수 없는 세율 유형('${String((spec as Record<string, unknown>).type)}')입니다.`
}

/**
 * @함수명: evaluateRateSpec
 * @설명: 세율 명세를 과세표준에 적용해 세액(원, 절사 전)을 계산합니다.
 *        linear_by_base는 산식 결과(세율%)에 룰이 지정한 소수점 처리(rounding)를
 *        먼저 적용한 뒤(법령 산식의 일부), 관리자 상·하한(min/maxPercent)으로 자릅니다.
 *        반올림 지정이 없으면 반올림하지 않습니다. 음수 세율은 0으로 고정합니다.
 * @매개변수: spec - 세율 명세 / taxBase - 과세표준(원)
 * @반환값: 세액 (절사 전)
 */
export function evaluateRateSpec(spec: RateSpec, taxBase: number): number {
  let percent: number
  if (spec.type === 'fixed') {
    percent = spec.ratePercent
  } else {
    percent = spec.slopePercent * (taxBase / spec.per) + spec.interceptPercent
    if (spec.rounding) {
      const factor = Math.pow(10, spec.rounding.decimals)
      const fn = spec.rounding.method === 'floor' ? Math.floor : spec.rounding.method === 'ceil' ? Math.ceil : Math.round
      percent = fn(percent * factor) / factor
    }
    if (spec.minPercent !== undefined) percent = Math.max(percent, spec.minPercent)
    if (spec.maxPercent !== undefined) percent = Math.min(percent, spec.maxPercent)
  }
  percent = Math.max(percent, 0)
  return (taxBase * percent) / 100
}

// ─── 조건 매칭 ───────────────────────────────────────────────────────────────

const CONDITION_OPS = ['eq', 'min', 'max', 'in'] as const

/**
 * @함수명: matchConditions
 * @설명: 세율 행의 when 조건을 판정 컨텍스트와 대조합니다.
 *        - 조건 필드가 컨텍스트에 없으면(관리자 오타 가능성) 조용히 불일치 처리하지 않고
 *          RULE_VALUE_INVALID로 중단합니다 — 오타 하나로 엉뚱한 행이 선택되는 것을 막는다.
 *        - 컨텍스트 값이 undefined(미확정 — 예: 시가표준액 미입력)인 필드를 조건으로 쓰는
 *          행은 매칭되지 않으며, 그 필드명을 unresolved로 돌려준다. 0·false로 간주하지 않는다.
 *          단, 확정된 다른 조건에서 이미 불일치가 난 행은 어차피 제외이므로 unresolved로 잡지 않는다.
 * @매개변수: when - 조건 집합 / context - 엔진이 만든 판정 컨텍스트(undefined=미확정) / ruleKey - 안내문용 룰 키
 * @반환값: { matched, unresolved } 또는 실패
 */
export function matchConditions(
  when: Conditions,
  context: Record<string, Json | undefined>,
  ruleKey: string,
): { ok: true; matched: boolean; unresolved: string[] } | TaxEngineFailure {
  const unresolved: string[] = []
  for (const [field, cond] of Object.entries(when)) {
    if (!(field in context)) {
      return invalid(ruleKey, `조건 필드 '${field}'는 엔진이 지원하지 않는 필드입니다. (지원: ${Object.keys(context).join(', ')})`)
    }
    if (!isObj(cond)) return invalid(ruleKey, `조건 '${field}'가 객체가 아닙니다.`)
    for (const op of Object.keys(cond)) {
      if (!(CONDITION_OPS as readonly string[]).includes(op)) {
        return invalid(ruleKey, `조건 '${field}'에 알 수 없는 연산자('${op}')가 있습니다. (지원: eq·min·max·in)`)
      }
    }
    const v = context[field]
    const c = cond as ConditionSpec
    if (v === undefined) {
      // 값 미확정 — 이 행이 맞는지 판정할 수 없다. 사유를 기록하고 다음 필드 검증은 계속한다
      unresolved.push(field)
      continue
    }
    if (c.eq !== undefined && v !== c.eq) return { ok: true, matched: false, unresolved: [] }
    if (c.min !== undefined) {
      if (!isNum(c.min)) return invalid(ruleKey, `조건 '${field}'의 min이 숫자가 아닙니다.`)
      if (typeof v !== 'number' || v < c.min) return { ok: true, matched: false, unresolved: [] }
    }
    if (c.max !== undefined) {
      if (!isNum(c.max)) return invalid(ruleKey, `조건 '${field}'의 max가 숫자가 아닙니다.`)
      if (typeof v !== 'number' || v > c.max) return { ok: true, matched: false, unresolved: [] }
    }
    if (c.in !== undefined) {
      if (!Array.isArray(c.in)) return invalid(ruleKey, `조건 '${field}'의 in이 배열이 아닙니다.`)
      if (!c.in.some((item) => item === v)) return { ok: true, matched: false, unresolved: [] }
    }
  }
  if (unresolved.length > 0) return { ok: true, matched: false, unresolved }
  return { ok: true, matched: true, unresolved: [] }
}

// ─── 세율표 행 검증·선택 ─────────────────────────────────────────────────────

const RATE_ITEMS = ['acquisition', 'local_education', 'rural_special'] as const

/** 세율표 행 배열 검증 — 통과하면 null, 실패하면 실패 결과 */
function checkRows(rows: unknown, ruleKey: string): TaxEngineFailure | null {
  if (!Array.isArray(rows) || rows.length === 0) return invalid(ruleKey, 'rows가 비어 있지 않은 배열이 아닙니다.')
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!isObj(row)) return invalid(ruleKey, `rows[${i}]가 객체가 아닙니다.`)
    if (!isObj(row.when)) return invalid(ruleKey, `rows[${i}].when이 객체가 아닙니다.`)
    if (row.priority !== undefined && !isNum(row.priority)) return invalid(ruleKey, `rows[${i}].priority가 숫자가 아닙니다.`)
    if (!isObj(row.rates)) return invalid(ruleKey, `rows[${i}].rates가 객체가 아닙니다.`)
    for (const item of RATE_ITEMS) {
      const reason = checkRateSpec((row.rates as Record<string, unknown>)[item])
      if (reason) return invalid(ruleKey, `rows[${i}].rates.${item} — ${reason}`)
    }
    if (row.credit !== undefined) {
      const credit = row.credit
      if (!isObj(credit)) return invalid(ruleKey, `rows[${i}].credit이 객체가 아닙니다.`)
      if (!(RATE_ITEMS as readonly string[]).includes(String(credit.target))) {
        return invalid(ruleKey, `rows[${i}].credit.target은 acquisition·local_education·rural_special 중 하나여야 합니다.`)
      }
      if (!isNum(credit.amount) || credit.amount < 0) return invalid(ruleKey, `rows[${i}].credit.amount가 0 이상 숫자가 아닙니다.`)
    }
  }
  return null
}

/**
 * @함수명: parseRateTable
 * @설명: 세율표 rule_value({ rows: [...] })를 검증해 반환합니다.
 */
export function parseRateTable(
  value: Json,
  ruleKey: string,
): { ok: true; rows: RateTableRow[] } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const err = checkRows(value.rows, ruleKey)
  if (err) return err
  return { ok: true, rows: value.rows as unknown as RateTableRow[] }
}

/**
 * @함수명: selectRateRow
 * @설명: 조건에 맞는 세율 행을 고릅니다. 0건이면 NO_MATCHING_RATE_ROW,
 *        여러 건이면 priority 최고 1건(동률이면 AMBIGUOUS_RATE_ROW)입니다.
 *        조용히 아무 행이나 고르지 않는다.
 *        값 미확정으로 판정하지 못하고 건너뛴 행이 있으면 그 조건 필드명을
 *        unresolved로 함께 돌려준다 — 행이 선택됐어도 화면이 이 사실을 표시해야 한다.
 */
export function selectRateRow(
  rows: RateTableRow[],
  context: Record<string, Json | undefined>,
  ruleKey: string,
): { ok: true; row: RateTableRow; unresolved: string[] } | TaxEngineFailure {
  const matched: RateTableRow[] = []
  const unresolvedAll = new Set<string>()
  for (const row of rows) {
    const m = matchConditions(row.when, context, ruleKey)
    if (!m.ok) return m
    if (m.matched) matched.push(row)
    else m.unresolved.forEach((f) => unresolvedAll.add(f))
  }
  const unresolved = Array.from(unresolvedAll)
  if (matched.length === 0) {
    const hint =
      unresolved.length > 0
        ? ` 입력하지 않은 값(${unresolved.join(', ')}) 때문에 판정하지 못한 행이 있습니다 — 해당 값을 입력하면 결과가 나올 수 있습니다.`
        : ''
    return engineFail(
      'NO_MATCHING_RATE_ROW',
      `룰('${ruleKey}')의 세율표에 입력 조건에 해당하는 행이 없습니다. 해당 조건의 세율이 등록될 때까지 이 계산은 제공되지 않습니다.${hint}`,
      ruleKey,
    )
  }
  if (matched.length === 1) return { ok: true, row: matched[0], unresolved }
  const top = Math.max(...matched.map((r) => r.priority ?? 0))
  const winners = matched.filter((r) => (r.priority ?? 0) === top)
  if (winners.length > 1) {
    return engineFail(
      'AMBIGUOUS_RATE_ROW',
      `룰('${ruleKey}')의 세율표에서 입력 조건에 맞는 행이 ${winners.length}건이라 하나로 정할 수 없습니다. 관리자 화면에서 행 조건·우선순위를 정리해 주세요.`,
      ruleKey,
    )
  }
  return { ok: true, row: winners[0], unresolved }
}

// ─── 개별 rule_value 파서 ────────────────────────────────────────────────────

/**
 * 증여 과세표준 기준 rule_value 검증.
 * base만 있으면 고정 기준, choice가 있으면 납세자 선택 가능 구간까지 검증한다.
 * 기준 금액(maxAmount)은 룰에서만 온다 — 코드는 금액을 모른다.
 */
export function parseGiftTaxBase(
  value: Json,
  ruleKey: string,
): { ok: true; value: GiftTaxBaseValue } | TaxEngineFailure {
  if (!isObj(value) || (value.base !== 'market_value' && value.base !== 'official_price')) {
    return invalid(ruleKey, "base는 'market_value' 또는 'official_price'여야 합니다.")
  }
  let choice: GiftTaxBaseValue['choice']
  if (value.choice !== undefined) {
    const c = value.choice
    if (!isObj(c)) return invalid(ruleKey, 'choice가 객체가 아닙니다.')
    if (c.basis !== 'price' && c.basis !== 'market_value' && c.basis !== 'official_price') {
      return invalid(ruleKey, "choice.basis는 'price'·'market_value'·'official_price' 중 하나여야 합니다.")
    }
    if (!isNum(c.maxAmount) || c.maxAmount < 0) {
      return invalid(ruleKey, 'choice.maxAmount가 0 이상 숫자가 아닙니다.')
    }
    if (!Array.isArray(c.options) || c.options.length === 0) {
      return invalid(ruleKey, 'choice.options가 비어 있지 않은 배열이 아닙니다.')
    }
    for (let i = 0; i < c.options.length; i++) {
      if (c.options[i] !== 'market_value' && c.options[i] !== 'official_price') {
        return invalid(ruleKey, `choice.options[${i}]는 'market_value' 또는 'official_price'여야 합니다.`)
      }
    }
    choice = { basis: c.basis, maxAmount: c.maxAmount, options: c.options as GiftTaxBasis[] }
  }
  return { ok: true, value: { base: value.base, choice } }
}

/** 증여 중과 rule_value 검증 */
export function parseGiftHeavy(
  value: Json,
  ruleKey: string,
): { ok: true; value: GiftHeavyValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (!isNum(value.officialPriceMin) || value.officialPriceMin < 0) {
    return invalid(ruleKey, 'officialPriceMin이 0 이상 숫자가 아닙니다.')
  }
  const err = checkRows(value.rows, ruleKey)
  if (err) return err
  return {
    ok: true,
    value: { officialPriceMin: value.officialPriceMin, rows: value.rows as unknown as RateTableRow[] },
  }
}

/** 무상취득 간주 기준 rule_value 검증 */
export function parseDeemedGiftThreshold(
  value: Json,
  ruleKey: string,
): { ok: true; value: DeemedGiftThresholdValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (value.mode !== 'any' && value.mode !== 'all') return invalid(ruleKey, "mode는 'any' 또는 'all'이어야 합니다.")
  if (value.minDiffAmount !== undefined && (!isNum(value.minDiffAmount) || value.minDiffAmount < 0)) {
    return invalid(ruleKey, 'minDiffAmount가 0 이상 숫자가 아닙니다.')
  }
  if (value.minDiffRatioPercent !== undefined && (!isNum(value.minDiffRatioPercent) || value.minDiffRatioPercent < 0)) {
    return invalid(ruleKey, 'minDiffRatioPercent가 0 이상 숫자가 아닙니다.')
  }
  if (value.minDiffAmount === undefined && value.minDiffRatioPercent === undefined) {
    return invalid(ruleKey, '기준(minDiffAmount·minDiffRatioPercent) 중 하나 이상이 필요합니다.')
  }
  return {
    ok: true,
    value: {
      mode: value.mode,
      minDiffAmount: value.minDiffAmount as number | undefined,
      minDiffRatioPercent: value.minDiffRatioPercent as number | undefined,
    },
  }
}

/**
 * @함수명: isDeemedGift
 * @설명: 차액(시가인정액 − 지급대가)이 룰 기준을 넘는지 판정합니다. 기준값은 전부 룰에서 온다.
 */
export function isDeemedGift(
  threshold: DeemedGiftThresholdValue,
  marketValue: number,
  paidPrice: number,
): boolean {
  const diff = Math.max(marketValue - paidPrice, 0)
  const checks: boolean[] = []
  if (threshold.minDiffAmount !== undefined) checks.push(diff >= threshold.minDiffAmount)
  if (threshold.minDiffRatioPercent !== undefined) {
    checks.push(diff >= (marketValue * threshold.minDiffRatioPercent) / 100)
  }
  return threshold.mode === 'any' ? checks.some(Boolean) : checks.every(Boolean)
}

/** 단수 처리 rule_value 검증 */
export function parseRounding(
  value: Json,
  ruleKey: string,
): { ok: true; value: RoundingValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  if (!isNum(value.unit) || value.unit < 1 || !Number.isInteger(value.unit)) {
    return invalid(ruleKey, 'unit이 1 이상 정수가 아닙니다.')
  }
  if (value.method !== 'floor' && value.method !== 'round' && value.method !== 'ceil') {
    return invalid(ruleKey, "method는 'floor'·'round'·'ceil' 중 하나여야 합니다.")
  }
  return { ok: true, value: { unit: value.unit, method: value.method } }
}

/**
 * @함수명: applyRounding
 * @설명: 세액에 단수 처리를 적용합니다. 단수 처리 룰이 없으면 1원 단위 버림이 기본입니다.
 */
export function applyRounding(amount: number, rounding: RoundingValue | null): number {
  if (!rounding) return Math.floor(amount)
  const fn = rounding.method === 'floor' ? Math.floor : rounding.method === 'ceil' ? Math.ceil : Math.round
  return fn(amount / rounding.unit) * rounding.unit
}

/**
 * @함수명: parseMetroScope
 * @설명: 수도권 범위 rule_value({ sidoNames: [...] })를 검증해 반환합니다.
 *        시·도 이름 목록은 전부 관리자가 입력한다 — 코드에 지역 이름을 넣지 않는다.
 */
export function parseMetroScope(
  value: Json,
  ruleKey: string,
): { ok: true; value: MetroScopeValue } | TaxEngineFailure {
  if (!isObj(value)) return invalid(ruleKey, '값이 객체가 아닙니다.')
  const names = value.sidoNames
  if (!Array.isArray(names) || names.length === 0) {
    return invalid(ruleKey, 'sidoNames가 비어 있지 않은 배열이 아닙니다.')
  }
  for (let i = 0; i < names.length; i++) {
    if (typeof names[i] !== 'string' || (names[i] as string).trim() === '') {
      return invalid(ruleKey, `sidoNames[${i}]가 비어 있지 않은 문자열이 아닙니다.`)
    }
  }
  return { ok: true, value: { sidoNames: names as string[] } }
}
