/**
 * @파일: lib/tax/comprehensive.ts
 * @설명: 종합부동산세(주택분·인별) 계산기.
 *        엔진은 세율·비율·공제액·구간·한도·과세기준일을 모른다: 전부 DB 룰(comprehensive.*)
 *        에서 읽고, 코드는 계산 순서(과세기준일 산출 → 기본공제 → 과세표준 → 세율(일반/중과) →
 *        재산세 상당액 공제 → 1세대 1주택 세액공제 → 세부담 상한 → 농어촌특별세)만 안다.
 *        ⚠️ 재산세 상당액 공제는 사용자에게 묻지 않고 재산세 엔진을 호출해 자동 계산한다 —
 *        종부세 과세표준을 공시가격으로 넘겨(일반 비율·일반 세율표·도시지역분 제외) 나온
 *        본세가 표준 산식의 재산세 상당액이다. 재산세 룰이 없어 계산이 안 되면 조용히
 *        0으로 처리하지 않고 종부세 계산 전체를 중단하고 그 사실을 알린다.
 *        공시가격 합계가 기본공제 이하면 0원만 반환하지 않고 왜 과세 대상이 아닌지 담는다.
 *        룰이 없으면 0원으로 계산하지 않고 RULE_NOT_REGISTERED를 반환한다.
 *        ⚠️ 기본공제·공정시장가액비율·세액공제 3종은 구 형식(확정법)과 신 형식(2026 세제
 *        개편안)을 모두 지원한다 — 계산 방식은 모드가 아니라 '집힌 룰의 값 형식'이 정하며,
 *        확정법 룰은 재등록 없이 구 형식 그대로 동작한다(형식 정의는 comprehensive-types.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json, TaxRule, TaxRuleMode } from './types'
import type { AppliedRuleInfo, RoundingValue, TaxEngineFailure } from './engine-types'
import type {
  ComprehensiveInput,
  ComprehensiveResult,
  ComprehensiveSuccess,
  ComprehensiveTaxCreditDetail,
} from './comprehensive-types'
import type { PropertyCapStatus } from './property-types'
import { engineFail, fetchValidRules, isValidDateString, requireRule } from './rule-store'
import { applyRounding, evaluateRateSpec, parseRounding, selectRateRow, selectRateRowOptional } from './rule-value'
import { evaluateAmountSpec } from './amount-spec'
import {
  parsePropertyAssessmentDate,
  parsePropertyBurdenCap,
} from './property-rules'
import { calculatePropertyTax } from './property'
import {
  COMPREHENSIVE_RULE_KEYS,
  parseComprehensiveAssessmentRatio,
  parseComprehensiveBasicDeduction,
  parseComprehensiveRates,
  parseComprehensiveRuralSurtax,
  parseComprehensiveTaxCredit,
} from './comprehensive-rules'

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
function validateInput(input: ComprehensiveInput): TaxEngineFailure | null {
  // 4자리 연도 제한은 날짜 문자열(YYYY-MM-DD) 조합을 위한 형식 요건이다 — 세법 값이 아니다
  if (!Number.isInteger(input.taxYear) || input.taxYear < 1000 || input.taxYear > 9999) {
    return engineFail('INVALID_INPUT', '과세연도는 4자리 연도(정수)여야 합니다.')
  }
  if (input.houseCount !== 1 && input.houseCount !== 2 && input.houseCount !== 3) {
    return engineFail('INVALID_INPUT', '보유 주택 수가 올바르지 않습니다.')
  }
  if (!Number.isFinite(input.totalOfficialPrice) || input.totalOfficialPrice <= 0) {
    return engineFail('INVALID_INPUT', '공시가격 합계는 0보다 큰 숫자여야 합니다.')
  }
  if (typeof input.isOneHouse !== 'boolean') {
    return engineFail('INVALID_INPUT', '1세대 1주택 여부가 올바르지 않습니다.')
  }
  if (input.isOneHouse && input.houseCount !== 1) {
    return engineFail('INVALID_INPUT', '1세대 1주택은 보유 주택 수가 1이어야 합니다.')
  }
  if (input.isOneHouse) {
    // 연령·보유기간 세액공제 판정에 필요 — 미입력을 '공제 없음'으로 간주하지 않는다
    if (input.age === undefined || !Number.isFinite(input.age) || input.age < 0) {
      return engineFail('INVALID_INPUT', '1세대 1주택 판정에는 나이(만 나이) 입력이 필요합니다.')
    }
    if (input.holdingYears === undefined || !Number.isFinite(input.holdingYears) || input.holdingYears < 0) {
      return engineFail('INVALID_INPUT', '1세대 1주택 판정에는 보유기간(만 연수) 입력이 필요합니다.')
    }
  }
  if (input.prevTotalTax !== undefined && (!Number.isFinite(input.prevTotalTax) || input.prevTotalTax < 0)) {
    return engineFail('INVALID_INPUT', '직전 연도 총세액은 0 이상의 숫자여야 합니다.')
  }
  // ── 2026 세제개편안(신 형식 룰) 판정용 입력 — 전부 선택 입력이며, 실제 요구 여부는
  //    엔진이 신 형식 룰을 읽은 시점에 형식별로 판단한다(여기서 존재를 강제하지 않는다)
  if (input.residenceYears !== undefined && (!Number.isFinite(input.residenceYears) || input.residenceYears < 0)) {
    return engineFail('INVALID_INPUT', '거주기간은 0 이상의 숫자(만 연수)여야 합니다.')
  }
  if (input.isResiding !== undefined && typeof input.isResiding !== 'boolean') {
    return engineFail('INVALID_INPUT', '현재 거주 여부가 올바르지 않습니다.')
  }
  if (input.hasRegulatedHouse !== undefined && typeof input.hasRegulatedHouse !== 'boolean') {
    return engineFail('INVALID_INPUT', '조정대상지역 주택 보유 여부가 올바르지 않습니다.')
  }
  if (input.residingOfficialPrice !== undefined) {
    if (!Number.isFinite(input.residingOfficialPrice) || input.residingOfficialPrice < 0) {
      return engineFail('INVALID_INPUT', '현재 거주 중인 주택의 공시가격은 0 이상의 숫자여야 합니다(거주하지 않으면 0).')
    }
    if (input.residingOfficialPrice > input.totalOfficialPrice) {
      return engineFail('INVALID_INPUT', '현재 거주 중인 주택의 공시가격이 공시가격 합계를 넘을 수 없습니다.')
    }
  }
  return null
}

/**
 * @함수명: calculateComprehensiveTax
 * @설명: 종합부동산세를 계산합니다. 결과에는 과세 대상 여부와 그 사유, 중과 표 사용 여부,
 *        재산세 상당액 공제(자동), 세액공제 상세(연령분·보유분), 상한 처리까지 전부 담습니다.
 *        룰이 하나라도 없으면 0원 대신 실패(한국어 안내)를 반환합니다.
 * @매개변수: supabase - Supabase 클라이언트(서버) / input - 계산 입력 / mode - 룰 모드
 * @반환값: 성공(항목별 세액 + 근거) 또는 실패(한국어 안내)
 */
export async function calculateComprehensiveTax(
  supabase: SupabaseClient,
  input: ComprehensiveInput,
  mode: TaxRuleMode,
): Promise<ComprehensiveResult> {
  const inputError = validateInput(input)
  if (inputError) return inputError

  // ── 1단계: 과세기준일 산출 — 재산세와 같은 2단계 조회 (코드에 날짜 없음) ────
  const provisionalDate = `${input.taxYear}-01-01`
  const firstFetch = await fetchValidRules(supabase, 'comprehensive', provisionalDate, mode)
  if (!firstFetch.ok) return firstFetch
  const dateRuleFirst = requireRule(firstFetch.rules, COMPREHENSIVE_RULE_KEYS.assessmentDate, provisionalDate)
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
      COMPREHENSIVE_RULE_KEYS.assessmentDate,
    )
  }

  // ── 2단계: 과세기준일 시점의 룰 세트 로드 ───────────────────────────────────
  const fetched = await fetchValidRules(supabase, 'comprehensive', baseDate, mode)
  if (!fetched.ok) return fetched
  const rules = fetched.rules

  const applied = new Map<string, AppliedRuleInfo>()
  const use = (rule: TaxRule) => applied.set(rule.id, toAppliedInfo(rule))
  const unresolvedFields = new Set<string>()

  const dateRule = requireRule(rules, COMPREHENSIVE_RULE_KEYS.assessmentDate, baseDate)
  if (!dateRule.ok) return dateRule
  const dateParsed = parsePropertyAssessmentDate(dateRule.rule.rule_value, dateRule.rule.rule_key)
  if (!dateParsed.ok) return dateParsed
  if (dateParsed.value.month !== dateFirst.value.month || dateParsed.value.day !== dateFirst.value.day) {
    return engineFail(
      'RULE_CONFLICT',
      `과세기준일 룰이 ${input.taxYear}년 안에서 바뀌어(연초와 과세기준일 시점의 값이 다름) 기준일을 정할 수 없습니다. 관리자 화면에서 룰 시행기간을 정리해 주세요.`,
      COMPREHENSIVE_RULE_KEYS.assessmentDate,
    )
  }
  use(dateRule.rule)

  // ── 과세표준 산출 전 판정 컨텍스트 — 기본공제·공정시장가액비율의 신 형식 행 조건과
  //    금액 산식(AmountSpec)이 쓴다. tax_base는 아직 없다(과세표준 조건은 세율표 이후 컨텍스트에서만).
  const baseContext: Record<string, Json | undefined> = {
    house_count: input.houseCount,                        // 보유 주택 수 (3 = 3주택 이상)
    is_one_house: input.isOneHouse,                       // 1세대 1주택 여부
    total_official_price: input.totalOfficialPrice,       // 공시가격 합계 (원)
    age: input.age,                                       // 만 나이 — 1세대 1주택이 아니면 미확정
    holding_years: input.holdingYears,                    // 보유기간 (만 연수) — 1세대 1주택이 아니면 미확정
    residence_years: input.residenceYears,                // 거주기간 (만 연수) — 신 형식 세액공제 판정, 미입력이면 미확정
    is_residing: input.isResiding,                        // 현재 거주 여부 — 신 형식 기본공제 갈림, 미입력이면 미확정
    residing_official_price: input.residingOfficialPrice, // 거주 주택 공시가격 (원) — 산식 분자, 미입력이면 미확정
    has_regulated_house: input.hasRegulatedHouse,         // 조정대상지역 주택 보유 — 자동 판정 불가라 자기신고
  }

  // ── 기본공제 — 이르지 않으면 '과세 대상 아님'을 사유와 함께 반환 ────────────
  // 구 형식(확정법)은 1세대 1주택 여부 이지선다, 신 형식(개정안)은 행 조건 + AmountSpec 금액.
  const basicRule = requireRule(rules, COMPREHENSIVE_RULE_KEYS.basicDeduction, baseDate)
  if (!basicRule.ok) return basicRule
  const basic = parseComprehensiveBasicDeduction(basicRule.rule.rule_value, basicRule.rule.rule_key)
  if (!basic.ok) return basic
  use(basicRule.rule)
  const deductionType: 'one_house' | 'general' = input.isOneHouse ? 'one_house' : 'general'
  let deduction: number
  let deductionLabel: string | null = null
  if (basic.value.format === 'fixed_pair') {
    deduction = input.isOneHouse ? basic.value.oneHouseAmount : basic.value.generalAmount
  } else {
    const picked = selectRateRow(basic.value.rows, baseContext, basicRule.rule.rule_key)
    if (!picked.ok) return picked
    picked.unresolved.forEach((f) => unresolvedFields.add(f))
    const amount = evaluateAmountSpec(picked.row.deduction, baseContext, basicRule.rule.rule_key)
    if (!amount.ok) return amount
    deduction = amount.amount
    deductionLabel = picked.row.label ?? null
  }

  if (input.totalOfficialPrice <= deduction) {
    return buildSuccess({
      taxable: false,
      notTaxableReason:
        `공시가격 합계 ${input.totalOfficialPrice.toLocaleString('ko-KR')}원이 기본공제 ` +
        `${deduction.toLocaleString('ko-KR')}원(${deductionLabel ?? (deductionType === 'one_house' ? '1세대 1주택 기준' : '일반 기준')}) ` +
        `이하라 종합부동산세 과세 대상이 아닙니다. 재산세는 별도로 부과됩니다.`,
      taxBase: 0,
      heavyTableApplied: false,
      rateReason: '과세 대상이 아니라 세율을 적용하지 않았습니다.',
      taxCredit: null,
      burdenCap: { status: 'skipped', reason: '과세 대상이 아니라 상한 판정이 필요 없습니다.' },
      breakdown: { rawTax: 0, propertyDeduction: 0, taxCreditAmount: 0, comprehensiveTax: 0, ruralSurtax: 0, total: 0 },
    })
  }

  // ── 과세표준 = (공시가격 합계 − 기본공제) × 공정시장가액비율 ────────────────
  // 구 형식은 단일 비율, 신 형식은 행 조건(주택 수·조정대상지역 보유 등)별 비율.
  const ratioRule = requireRule(rules, COMPREHENSIVE_RULE_KEYS.assessmentRatio, baseDate)
  if (!ratioRule.ok) return ratioRule
  const ratio = parseComprehensiveAssessmentRatio(ratioRule.rule.rule_value, ratioRule.rule.rule_key)
  if (!ratio.ok) return ratio
  use(ratioRule.rule)
  let ratioPercent: number
  if (ratio.value.format === 'single') {
    ratioPercent = ratio.value.ratioPercent
  } else {
    const picked = selectRateRow(ratio.value.rows, baseContext, ratioRule.rule.rule_key)
    if (!picked.ok) return picked
    picked.unresolved.forEach((f) => unresolvedFields.add(f))
    ratioPercent = picked.row.ratioPercent
  }
  const taxBase = Math.floor(((input.totalOfficialPrice - deduction) * ratioPercent) / 100)

  // 판정 컨텍스트 — 행(when) 조건은 이 필드들만 쓸 수 있다 (과세표준 전 컨텍스트 + tax_base)
  const context: Record<string, Json | undefined> = {
    ...baseContext,
    tax_base: taxBase,                       // 과세표준 (원) — 중과 갈림 조건에 사용
  }

  // ── 세율 — 일반/중과는 관리자가 행 조건(주택 수·과세표준)과 heavy 표시로 정한다 ──
  const ratesRule = requireRule(rules, COMPREHENSIVE_RULE_KEYS.rates, baseDate)
  if (!ratesRule.ok) return ratesRule
  const rates = parseComprehensiveRates(ratesRule.rule.rule_value, ratesRule.rule.rule_key)
  if (!rates.ok) return rates
  const ratePicked = selectRateRow(rates.value.rows, context, ratesRule.rule.rule_key)
  if (!ratePicked.ok) return ratePicked
  ratePicked.unresolved.forEach((f) => unresolvedFields.add(f))
  use(ratesRule.rule)
  const heavyTableApplied = ratePicked.row.heavy === true
  const rateReason = heavyTableApplied
    ? '주택 수·과세표준 조건이 중과 세율표 행에 해당해 중과 세율을 적용했습니다.'
    : '일반 세율표를 적용했습니다.'
  const rawTax = evaluateRateSpec(ratePicked.row.rate, taxBase)

  // ── 재산세 상당액 공제 — 재산세 엔진 자동 호출 (사용자에게 묻지 않는다) ─────
  // 종부세 과세표준을 공시가격으로 넘기면: 재산세 일반 공정시장가액비율을 곱한 값에
  // 일반(표준) 세율표를 적용한 본세 = 표준 산식의 재산세 상당액. 본세만 모드라
  // 부가 세목(property.surtax) 룰 없이도 계산되고, 특례·도시지역분은 제외된다.
  const propRes = await calculatePropertyTax(
    supabase,
    { taxYear: input.taxYear, officialPrice: taxBase, isOneHouse: false, isUrbanArea: false },
    mode,
    { mainTaxOnly: true },
  )
  if (!propRes.ok) {
    return engineFail(
      propRes.code,
      `재산세 상당액 공제를 계산할 수 없어 종합부동산세 계산을 중단했습니다(0원으로 대체하지 않습니다). ${propRes.message}`,
      propRes.ruleKey,
    )
  }
  const propertyDeduction = propRes.breakdown.mainTax
  // 공제 계산에 실제 쓰인 재산세 룰을 근거에 포함한다 — 본세만 모드라 부가 세목 룰은
  // 애초에 사용되지 않으므로 근거 목록이 계산과 정확히 일치한다.
  for (const r of propRes.appliedRules) {
    applied.set(r.id, r)
  }
  const afterProperty = Math.max(rawTax - propertyDeduction, 0)

  // ── 1세대 1주택 세액공제 — 구 형식은 연령분·보유분 합산(% 한도), 신 형식은
  //    연령분 합산(좌동) + 보유분·거주분 중 높은 쪽 + % 한도(좌동) + 금액 한도(신설).
  //    형식은 룰 값이 정한다.
  let taxCredit: ComprehensiveTaxCreditDetail | null = null
  let afterCredit = afterProperty
  if (input.isOneHouse) {
    const creditRule = requireRule(rules, COMPREHENSIVE_RULE_KEYS.taxCredit, baseDate)
    if (!creditRule.ok) return creditRule
    const credit = parseComprehensiveTaxCredit(creditRule.rule.rule_value, creditRule.rule.rule_key)
    if (!credit.ok) return credit
    // 행 미매칭 = 그 축의 공제 없음(요건 미달)이 정상 의미 — selectRateRowOptional 사용
    const agePicked = selectRateRowOptional(credit.value.ageRows, context, creditRule.rule.rule_key)
    if (!agePicked.ok) return agePicked
    const agePercent = agePicked.row?.creditPercent ?? 0
    agePicked.unresolved.forEach((f) => unresolvedFields.add(f))
    if (credit.value.format === 'sum_holding') {
      const holdingPicked = selectRateRowOptional(credit.value.holdingRows, context, creditRule.rule.rule_key)
      if (!holdingPicked.ok) return holdingPicked
      holdingPicked.unresolved.forEach((f) => unresolvedFields.add(f))
      use(creditRule.rule)
      const holdingPercent = holdingPicked.row?.creditPercent ?? 0
      const sumPercent = agePercent + holdingPercent
      const capReached = sumPercent > credit.value.maxTotalPercent
      const totalPercentApplied = capReached ? credit.value.maxTotalPercent : sumPercent
      const amount = Math.floor((afterProperty * totalPercentApplied) / 100)
      taxCredit = { agePercent, holdingPercent, totalPercentApplied, capReached, amount }
    } else {
      // 신 형식 — 연령분은 그대로 합산(좌동)하고, 보유분·거주분 '둘 중에서만' 높은 쪽을
      // 골라 더한 뒤 합산 % 한도(좌동) → 공제액 한도(원·신설) 순서로 자른다.
      // 거주기간이 판정 기준이므로 미입력을 공제 0으로 간주하지 않고 입력을 요구한다
      if (input.residenceYears === undefined) {
        return engineFail(
          'INVALID_INPUT',
          '이 시점의 세액공제 룰은 거주기간 기준입니다 — 1세대 1주택 세액공제 판정에는 거주기간(만 연수) 입력이 필요합니다.',
        )
      }
      // 보유 축(holdingRows) 생략 = 그 시행기간의 보유 기준 공제 폐지 — 0%로 계산하고 표시에 명시
      const holdingAbolished = credit.value.holdingRows === undefined
      let holdingPercent = 0
      if (credit.value.holdingRows) {
        const holdingPicked = selectRateRowOptional(credit.value.holdingRows, context, creditRule.rule.rule_key)
        if (!holdingPicked.ok) return holdingPicked
        holdingPicked.unresolved.forEach((f) => unresolvedFields.add(f))
        holdingPercent = holdingPicked.row?.creditPercent ?? 0
      }
      const residencePicked = selectRateRowOptional(credit.value.residenceRows, context, creditRule.rule.rule_key)
      if (!residencePicked.ok) return residencePicked
      residencePicked.unresolved.forEach((f) => unresolvedFields.add(f))
      use(creditRule.rule)
      const residencePercent = residencePicked.row?.creditPercent ?? 0
      // 보유분·거주분 중 높은 쪽 하나 — 동률이면 보유분으로 표기(공제액은 동일).
      // 보유 폐지 기간에는 거주분이 유일한 축이다.
      const chosenAxis: 'holding' | 'residence' =
        holdingAbolished || residencePercent > holdingPercent ? 'residence' : 'holding'
      const sumPercent = agePercent + Math.max(holdingPercent, residencePercent)
      const capReached = sumPercent > credit.value.maxTotalPercent
      const totalPercentApplied = capReached ? credit.value.maxTotalPercent : sumPercent
      const rawAmount = Math.floor((afterProperty * totalPercentApplied) / 100)
      const amountCapApplied = rawAmount > credit.value.maxAmount
      const amount = amountCapApplied ? credit.value.maxAmount : rawAmount
      taxCredit = {
        agePercent,
        holdingPercent,
        totalPercentApplied,
        capReached,
        amount,
        residencePercent,
        chosenAxis,
        amountCapApplied,
        holdingAbolished,
      }
    }
    afterCredit = afterProperty - taxCredit.amount
  }

  // ── 세부담 상한 — 직전 연도 총세액이 없으면 적용하지 않는다 (추정 금지) ─────
  // 비교 대상 = 당해 재산세 상당액 + 종부세액. 상한을 넘으면 종부세에서만 깎는다.
  let burdenCap: PropertyCapStatus
  let cappedTax = afterCredit
  const burdenRule = rules.get(COMPREHENSIVE_RULE_KEYS.burdenCap)
  if (!burdenRule) {
    burdenCap = { status: 'skipped', reason: '기준일에 유효한 세부담 상한 룰이 없어 상한을 적용하지 않았습니다.' }
  } else if (input.prevTotalTax === undefined) {
    burdenCap = {
      status: 'skipped',
      reason: '직전 연도 총세액을 입력하지 않아 세부담 상한을 적용하지 않았습니다. 상한은 세액을 낮추는 장치라 실제 고지서는 이보다 낮을 수 있습니다.',
    }
  } else if (input.prevTotalTax === 0) {
    // 0은 미입력과 동일하게 미적용 — 상한액 0원 = 종부세·농특세 0원이 정상 결과처럼
    // 보이는 함정(룰 값의 0 거부와 같은 취지의 사용자 입력 방어)
    burdenCap = {
      status: 'skipped',
      reason: '직전 연도 총세액이 0원이면 상한 기준을 만들 수 없어 상한을 적용하지 않았습니다. 작년 부과가 없었던 경우(신축 취득 등)의 상한 산정 방식은 이 계산기가 반영하지 못합니다.',
    }
  } else {
    const burden = parsePropertyBurdenCap(burdenRule.rule_value, burdenRule.rule_key)
    if (!burden.ok) return burden
    // 상한표에 빠진 조건이 있으면 조용히 미적용하지 않고 오류로 드러낸다 —
    // 직전 연도 값을 입력한 사용자는 상한이 반영됐다고 믿게 되기 때문이다
    const picked = selectRateRow(burden.value.rows, context, burdenRule.rule_key)
    if (!picked.ok) return picked
    picked.unresolved.forEach((f) => unresolvedFields.add(f))
    use(burdenRule)
    const capTotal = Math.floor((input.prevTotalTax * picked.row.capPercent) / 100)
    const currentTotal = propertyDeduction + afterCredit
    if (currentTotal > capTotal) {
      cappedTax = Math.max(capTotal - propertyDeduction, 0)
      burdenCap = { status: 'applied', capAmount: capTotal }
    } else {
      burdenCap = { status: 'not_exceeded', capAmount: capTotal }
    }
  }

  // ── 단수 처리 + 농어촌특별세(종부세액 비례) ─────────────────────────────────
  let rounding: RoundingValue | null = null
  const roundingRule = rules.get(COMPREHENSIVE_RULE_KEYS.rounding)
  if (roundingRule) {
    const parsed = parseRounding(roundingRule.rule_value, roundingRule.rule_key)
    if (!parsed.ok) return parsed
    rounding = parsed.value
    use(roundingRule)
  }
  const comprehensiveTax = applyRounding(cappedTax, rounding)

  const ruralRule = requireRule(rules, COMPREHENSIVE_RULE_KEYS.ruralSurtax, baseDate)
  if (!ruralRule.ok) return ruralRule
  const rural = parseComprehensiveRuralSurtax(ruralRule.rule.rule_value, ruralRule.rule.rule_key)
  if (!rural.ok) return rural
  use(ruralRule.rule)
  const ruralSurtax = applyRounding((comprehensiveTax * rural.value.ratePercent) / 100, rounding)

  return buildSuccess({
    taxable: true,
    notTaxableReason: null,
    taxBase,
    heavyTableApplied,
    rateReason,
    taxCredit,
    burdenCap,
    breakdown: {
      rawTax: Math.floor(rawTax),
      propertyDeduction,
      taxCreditAmount: taxCredit?.amount ?? 0,
      comprehensiveTax,
      ruralSurtax,
      total: comprehensiveTax + ruralSurtax,
    },
  })

  /** 공통 결과 조립 — 기본공제·근거·미확정 목록을 항상 함께 담는다 */
  function buildSuccess(partial: {
    taxable: boolean
    notTaxableReason: string | null
    taxBase: number
    heavyTableApplied: boolean
    rateReason: string
    taxCredit: ComprehensiveTaxCreditDetail | null
    burdenCap: PropertyCapStatus
    breakdown: ComprehensiveSuccess['breakdown']
  }): ComprehensiveSuccess {
    const appliedRules = Array.from(applied.values())
    return {
      ok: true,
      ...partial,
      baseDate,
      basicDeductionApplied: deduction,
      basicDeductionType: deductionType,
      basicDeductionLabel: deductionLabel,
      appliedRules,
      ruleMode: mode,
      containsProposedRule: appliedRules.some((r) => r.status === 'proposed'),
      unresolvedFields: Array.from(unresolvedFields),
    }
  }
}
