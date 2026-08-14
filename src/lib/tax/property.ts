/**
 * @파일: lib/tax/property.ts
 * @설명: 재산세(주택분) 계산기 — 연간 총액 기준(분납 회차는 화면이 안내).
 *        엔진은 세율·비율·구간·금액·과세기준일을 모른다: 전부 DB 룰(property.*)에서 읽고,
 *        코드는 계산 순서(과세기준일 산출 → 과세표준(비율) → 과세표준 상한 → 세율 →
 *        세부담 상한 → 지방교육세·도시지역분 → 단수 처리)만 안다.
 *        ⚠️ 과세기준일도 룰(property.assessment_date — 월·일)에서 온다. 룰 조회에는
 *        기준일이 필요한데 과세기준일 자체가 룰이라, 과세연도의 시작일(달력 상수 —
 *        세법상 날짜가 아니다)로 임시 조회해 월·일을 얻은 뒤 실제 과세기준일로 다시
 *        조회하는 2단계 구조를 쓴다.
 *        상한 2종(과세표준·세부담)은 직전 연도 값이 없으면 적용하지 않고 그 사실을
 *        결과에 담는다 — 추정 금지. 룰이 없으면 0원으로 계산하지 않고 RULE_NOT_REGISTERED.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json, TaxRule, TaxRuleMode } from './types'
import type { AppliedRuleInfo, RateSpec, RoundingValue, TaxEngineFailure } from './engine-types'
import type {
  PropertyCapStatus,
  PropertyEngineOptions,
  PropertyInput,
  PropertyResult,
  PropertySurtaxValue,
} from './property-types'
import { engineFail, fetchValidRules, isValidDateString, requireRule } from './rule-store'
import { applyRounding, evaluateRateSpec, parseRounding, selectRateRow } from './rule-value'
import {
  PROPERTY_RULE_KEYS,
  parsePropertyAssessmentDate,
  parsePropertyAssessmentRatio,
  parsePropertyAssessmentRatioOneHouse,
  parsePropertyBaseCap,
  parsePropertyBurdenCap,
  parsePropertyRates,
  parsePropertySurtax,
} from './property-rules'

/** 룰 행을 결과 화면용 근거 정보로 변환 (다른 세목과 동일 형식) */
function toAppliedInfo(rule: TaxRule): AppliedRuleInfo {
  return {
    id: rule.id,
    ruleKey: rule.rule_key,
    lawName: rule.law_name,
    lawArticle: rule.law_article,
    lawUrl: rule.law_url,
    effectiveFrom: rule.effective_from,
    effectiveTo: rule.effective_to,
    status: rule.status,
  }
}

/** 입력 검증 — 실패하면 한국어 안내가 담긴 실패 결과, 통과하면 null */
function validateInput(input: PropertyInput): TaxEngineFailure | null {
  // 4자리 연도 제한은 날짜 문자열(YYYY-MM-DD) 조합을 위한 형식 요건이다 — 세법 값이 아니다
  if (!Number.isInteger(input.taxYear) || input.taxYear < 1000 || input.taxYear > 9999) {
    return engineFail('INVALID_INPUT', '과세연도는 4자리 연도(정수)여야 합니다.')
  }
  if (!Number.isFinite(input.officialPrice) || input.officialPrice <= 0) {
    return engineFail('INVALID_INPUT', '공시가격은 0보다 큰 숫자여야 합니다.')
  }
  if (typeof input.isOneHouse !== 'boolean') {
    return engineFail('INVALID_INPUT', '1세대 1주택 여부가 올바르지 않습니다.')
  }
  if (typeof input.isUrbanArea !== 'boolean') {
    return engineFail('INVALID_INPUT', '도시지역 여부가 올바르지 않습니다.')
  }
  if (input.prevTaxBase !== undefined && (!Number.isFinite(input.prevTaxBase) || input.prevTaxBase < 0)) {
    return engineFail('INVALID_INPUT', '직전 연도 과세표준은 0 이상의 숫자여야 합니다.')
  }
  if (input.prevTaxAmount !== undefined && (!Number.isFinite(input.prevTaxAmount) || input.prevTaxAmount < 0)) {
    return engineFail('INVALID_INPUT', '직전 연도 재산세액은 0 이상의 숫자여야 합니다.')
  }
  return null
}

/**
 * @함수명: calculatePropertyTax
 * @설명: 재산세(주택분)를 계산합니다. 결과에는 세액뿐 아니라 어떤 공정시장가액비율·
 *        세율표를 왜 썼는지, 상한 2종이 각각 어떻게 처리됐는지를 전부 담습니다.
 *        룰이 하나라도 없으면 0원 대신 실패(한국어 안내)를 반환합니다.
 * @매개변수: supabase - Supabase 클라이언트(서버) / input - 계산 입력 / mode - 룰 모드
 *            options - 엔진 옵션(mainTaxOnly: 본세만 계산 — 종부세 공제용, 부가 세목 룰 불요구)
 * @반환값: 성공(항목별 세액 + 근거) 또는 실패(한국어 안내)
 */
export async function calculatePropertyTax(
  supabase: SupabaseClient,
  input: PropertyInput,
  mode: TaxRuleMode,
  options?: PropertyEngineOptions,
): Promise<PropertyResult> {
  const inputError = validateInput(input)
  if (inputError) return inputError

  // ── 1단계: 과세기준일 산출 — 월·일은 룰에서 온다 (코드에 날짜 없음) ─────────
  // 과세연도의 시작일은 '그 해의 첫날'이라는 달력 상수다 — 과세기준일 룰을 찾기 위한
  // 임시 조회일일 뿐 세액 판정에는 쓰지 않는다.
  const provisionalDate = `${input.taxYear}-01-01`
  const firstFetch = await fetchValidRules(supabase, 'property', provisionalDate, mode)
  if (!firstFetch.ok) return firstFetch
  const dateRuleFirst = requireRule(firstFetch.rules, PROPERTY_RULE_KEYS.assessmentDate, provisionalDate)
  if (!dateRuleFirst.ok) return dateRuleFirst
  const dateFirst = parsePropertyAssessmentDate(dateRuleFirst.rule.rule_value, dateRuleFirst.rule.rule_key)
  if (!dateFirst.ok) return dateFirst
  const mm = String(dateFirst.value.month).padStart(2, '0')
  const dd = String(dateFirst.value.day).padStart(2, '0')
  const baseDate = `${input.taxYear}-${mm}-${dd}`
  if (!isValidDateString(baseDate)) {
    return engineFail(
      'RULE_VALUE_INVALID',
      `과세기준일 룰의 월·일(${dateFirst.value.month}월 ${dateFirst.value.day}일)이 ${input.taxYear}년에 존재하지 않는 날짜입니다. 관리자 화면에서 룰 값을 수정해 주세요.`,
      PROPERTY_RULE_KEYS.assessmentDate,
    )
  }

  // ── 2단계: 과세기준일 시점의 룰 세트 로드 — 이후 모든 판정은 이 세트 기준 ───
  const fetched = await fetchValidRules(supabase, 'property', baseDate, mode)
  if (!fetched.ok) return fetched
  const rules = fetched.rules

  const applied = new Map<string, AppliedRuleInfo>()
  const use = (rule: TaxRule) => applied.set(rule.id, toAppliedInfo(rule))
  const unresolvedFields = new Set<string>()

  // 과세기준일 룰이 연초와 과세기준일 시점에 다르면(연중 변경) 어느 쪽이 맞는지 코드가
  // 정할 수 없다 — 계산을 중단하고 관리자에게 시행기간 정리를 요청한다.
  const dateRule = requireRule(rules, PROPERTY_RULE_KEYS.assessmentDate, baseDate)
  if (!dateRule.ok) return dateRule
  const dateParsed = parsePropertyAssessmentDate(dateRule.rule.rule_value, dateRule.rule.rule_key)
  if (!dateParsed.ok) return dateParsed
  if (dateParsed.value.month !== dateFirst.value.month || dateParsed.value.day !== dateFirst.value.day) {
    return engineFail(
      'RULE_CONFLICT',
      `과세기준일 룰이 ${input.taxYear}년 안에서 바뀌어(연초와 과세기준일 시점의 값이 다름) 기준일을 정할 수 없습니다. 관리자 화면에서 룰 시행기간을 정리해 주세요.`,
      PROPERTY_RULE_KEYS.assessmentDate,
    )
  }
  use(dateRule.rule)

  // 판정 컨텍스트 — 행(when) 조건은 이 필드들만 쓸 수 있다 (전부 필수 입력이라 미확정 없음)
  const context: Record<string, Json | undefined> = {
    official_price: input.officialPrice,   // 공시가격 (원)
    is_one_house: input.isOneHouse,        // 1세대 1주택 여부
  }

  // ── 공정시장가액비율 — 1세대 1주택 특례는 별도 룰의 시행기간(종료일)이 표현 ──
  let ratioPercent: number
  let ratioType: 'general' | 'one_house'
  let ratioReason: string
  const oneHouseRatioRule = input.isOneHouse ? rules.get(PROPERTY_RULE_KEYS.assessmentRatioOneHouse) : undefined
  if (oneHouseRatioRule) {
    const oneRatio = parsePropertyAssessmentRatioOneHouse(oneHouseRatioRule.rule_value, oneHouseRatioRule.rule_key)
    if (!oneRatio.ok) return oneRatio
    // 특례 구간표는 전 공시가격을 덮어야 한다 — 빠진 구간이 있으면 조용히 일반 비율로
    // 넘어가지 않고 오류로 드러낸다(더 높은 비율로 잘못 계산되는 것을 막는다)
    const picked = selectRateRow(oneRatio.value.rows, context, oneHouseRatioRule.rule_key)
    if (!picked.ok) return picked
    picked.unresolved.forEach((f) => unresolvedFields.add(f))
    use(oneHouseRatioRule)
    ratioPercent = picked.row.ratioPercent
    ratioType = 'one_house'
    ratioReason = `1세대 1주택 특례 공정시장가액비율 적용 — 공시가격 구간 기준 ${ratioPercent}%.`
  } else {
    const generalRule = requireRule(rules, PROPERTY_RULE_KEYS.assessmentRatio, baseDate)
    if (!generalRule.ok) return generalRule
    const general = parsePropertyAssessmentRatio(generalRule.rule.rule_value, generalRule.rule.rule_key)
    if (!general.ok) return general
    use(generalRule.rule)
    ratioPercent = general.value.ratioPercent
    ratioType = 'general'
    ratioReason = input.isOneHouse
      ? `기준일에 유효한 1세대 1주택 특례 비율 룰이 없어 일반 비율(${ratioPercent}%)을 적용했습니다. 한시 특례가 종료된 경우 이것이 법대로입니다.`
      : `일반 공정시장가액비율(${ratioPercent}%)을 적용했습니다.`
  }
  const taxBaseBeforeCap = Math.floor((input.officialPrice * ratioPercent) / 100)

  // ── 과세표준 상한 — 직전 연도 과세표준이 없으면 적용하지 않는다 (추정 금지) ──
  let taxBase = taxBaseBeforeCap
  let baseCap: PropertyCapStatus
  const baseCapRule = rules.get(PROPERTY_RULE_KEYS.baseCap)
  if (!baseCapRule) {
    baseCap = { status: 'skipped', reason: '기준일에 유효한 과세표준 상한 룰이 없어 상한을 적용하지 않았습니다.' }
  } else if (input.prevTaxBase === undefined) {
    baseCap = {
      status: 'skipped',
      reason: '직전 연도 과세표준을 입력하지 않아 과세표준 상한을 적용하지 않았습니다. 상한은 과세표준을 낮추는 장치라 실제 고지서는 이보다 낮을 수 있습니다.',
    }
  } else if (input.prevTaxBase === 0) {
    // 0은 미입력과 동일하게 미적용 — 0을 기준으로 상한을 만들면 과세표준 0원이
    // 정상 결과처럼 보인다(룰 값의 0 거부와 같은 취지의 사용자 입력 방어)
    baseCap = {
      status: 'skipped',
      reason: '직전 연도 과세표준이 0원이면 상한 기준을 만들 수 없어 상한을 적용하지 않았습니다. 작년 부과가 없었던 경우(신축 취득 등)의 상한 산정 방식은 이 계산기가 반영하지 못합니다.',
    }
  } else {
    const cap = parsePropertyBaseCap(baseCapRule.rule_value, baseCapRule.rule_key)
    if (!cap.ok) return cap
    use(baseCapRule)
    const basis = cap.value.increaseBasis === 'previous_base' ? input.prevTaxBase : taxBaseBeforeCap
    const capAmount = Math.floor(input.prevTaxBase + (basis * cap.value.increasePercent) / 100)
    if (taxBaseBeforeCap > capAmount) {
      taxBase = capAmount
      baseCap = { status: 'applied', capAmount }
    } else {
      baseCap = { status: 'not_exceeded', capAmount }
    }
  }

  // ── 세율 — 1세대 1주택 + 공시가격이 특례 기준 이하면 특례세율표 ─────────────
  const ratesRule = requireRule(rules, PROPERTY_RULE_KEYS.rates, baseDate)
  if (!ratesRule.ok) return ratesRule
  const rates = parsePropertyRates(ratesRule.rule.rule_value, ratesRule.rule.rule_key)
  if (!rates.ok) return rates
  use(ratesRule.rule)
  let rateSpec: RateSpec = rates.value.general
  let rateTable: 'general' | 'one_house_special' = 'general'
  let rateTableReason: string
  if (input.isOneHouse && rates.value.oneHouse && input.officialPrice <= rates.value.oneHouse.maxOfficialPrice) {
    rateSpec = rates.value.oneHouse.rate
    rateTable = 'one_house_special'
    rateTableReason = `1세대 1주택이고 공시가격이 특례 기준(${rates.value.oneHouse.maxOfficialPrice.toLocaleString('ko-KR')}원) 이하라 특례세율표를 적용했습니다.`
  } else if (!input.isOneHouse) {
    rateTableReason = '일반 세율표를 적용했습니다.'
  } else if (rates.value.oneHouse === undefined) {
    rateTableReason = '기준일 룰에 1세대 1주택 특례세율표가 없어 일반 세율표를 적용했습니다. 특례가 종료된 경우 이것이 법대로입니다.'
  } else {
    rateTableReason = `공시가격이 특례 기준(${rates.value.oneHouse.maxOfficialPrice.toLocaleString('ko-KR')}원)을 초과해 일반 세율표를 적용했습니다.`
  }
  const mainRaw = evaluateRateSpec(rateSpec, taxBase)

  // ── 세부담 상한 — 본세에만 적용. 경과조치 종료는 룰 시행기간이 표현 ──────────
  let mainAfterCap = mainRaw
  let burdenCap: PropertyCapStatus
  const burdenRule = rules.get(PROPERTY_RULE_KEYS.burdenCap)
  if (!burdenRule) {
    burdenCap = {
      status: 'skipped',
      reason: '기준일에 유효한 세부담 상한 룰이 없어 상한을 적용하지 않았습니다. 경과조치가 종료된 경우 이것이 법대로입니다.',
    }
  } else if (input.prevTaxAmount === undefined) {
    burdenCap = {
      status: 'skipped',
      reason: '직전 연도 재산세액(본세)을 입력하지 않아 세부담 상한을 적용하지 않았습니다. 상한은 세액을 낮추는 장치라 실제 고지서는 이보다 낮을 수 있습니다.',
    }
  } else if (input.prevTaxAmount === 0) {
    // 0은 미입력과 동일하게 미적용 — 상한액 0원 = 본세 0원이 정상 결과처럼 보이는 함정
    burdenCap = {
      status: 'skipped',
      reason: '직전 연도 재산세액이 0원이면 상한 기준을 만들 수 없어 상한을 적용하지 않았습니다. 작년 부과가 없었던 경우(신축 취득 등)의 상한 산정 방식은 이 계산기가 반영하지 못합니다.',
    }
  } else {
    const burden = parsePropertyBurdenCap(burdenRule.rule_value, burdenRule.rule_key)
    if (!burden.ok) return burden
    // 상한 구간표에 빠진 구간이 있으면 조용히 미적용하지 않고 오류로 드러낸다 —
    // 직전 연도 값을 입력한 사용자는 상한이 반영됐다고 믿게 되기 때문이다
    const picked = selectRateRow(burden.value.rows, context, burdenRule.rule_key)
    if (!picked.ok) return picked
    picked.unresolved.forEach((f) => unresolvedFields.add(f))
    use(burdenRule)
    const capAmount = Math.floor((input.prevTaxAmount * picked.row.capPercent) / 100)
    if (mainRaw > capAmount) {
      mainAfterCap = capAmount
      burdenCap = { status: 'applied', capAmount }
    } else {
      burdenCap = { status: 'not_exceeded', capAmount }
    }
  }

  // ── 지방교육세(본세 기준)·도시지역분(과세표준 기준) + 단수 처리 ─────────────
  // 본세만 모드(종부세의 재산세 상당액 공제용)에서는 부가 세목 룰을 요구하지 않는다 —
  // 공제 계산은 본세만 쓰므로 surtax 룰 부재가 종부세 계산을 막으면 논리에 맞지 않다.
  let surtaxValue: PropertySurtaxValue | null = null
  if (!options?.mainTaxOnly) {
    const surtaxRule = requireRule(rules, PROPERTY_RULE_KEYS.surtax, baseDate)
    if (!surtaxRule.ok) return surtaxRule
    const surtax = parsePropertySurtax(surtaxRule.rule.rule_value, surtaxRule.rule.rule_key)
    if (!surtax.ok) return surtax
    use(surtaxRule.rule)
    surtaxValue = surtax.value
  }

  let rounding: RoundingValue | null = null
  const roundingRule = rules.get(PROPERTY_RULE_KEYS.rounding)
  if (roundingRule) {
    const parsed = parseRounding(roundingRule.rule_value, roundingRule.rule_key)
    if (!parsed.ok) return parsed
    rounding = parsed.value
    use(roundingRule)
  }

  const mainTax = applyRounding(mainAfterCap, rounding)
  // 지방교육세는 세부담 상한이 적용된 뒤의 본세를 기준으로 계산한다(법 구조와 일치).
  // 도시지역분은 과세표준 기준이라 세부담 상한이 반영되지 않는다.
  const urbanAreaTax = surtaxValue !== null && input.isUrbanArea
    ? applyRounding(evaluateRateSpec(surtaxValue.urbanArea, taxBase), rounding)
    : 0
  const localEducationTax = surtaxValue !== null
    ? applyRounding(evaluateRateSpec(surtaxValue.localEducation, mainTax), rounding)
    : 0
  const total = mainTax + urbanAreaTax + localEducationTax

  const appliedRules = Array.from(applied.values())
  return {
    ok: true,
    baseDate,
    taxBaseBeforeCap,
    taxBase,
    assessmentRatioPercent: ratioPercent,
    assessmentRatioType: ratioType,
    assessmentRatioReason: ratioReason,
    rateTable,
    rateTableReason,
    baseCap,
    burdenCap,
    urbanAreaIncluded: input.isUrbanArea,
    breakdown: { mainTax, urbanAreaTax, localEducationTax, total },
    appliedRules,
    ruleMode: mode,
    containsProposedRule: appliedRules.some((r) => r.status === 'proposed'),
    unresolvedFields: Array.from(unresolvedFields),
  }
}
