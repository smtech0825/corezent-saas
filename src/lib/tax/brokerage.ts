/**
 * @파일: lib/tax/brokerage.ts
 * @설명: 부동산 중개수수료(중개보수) 상한 계산기 — 세금이 아니라 '법정 상한'을 계산한다.
 *        국가·조례는 "얼마를 내라"가 아니라 "이 금액을 넘을 수 없다"는 상한을 정하므로,
 *        이 엔진의 답은 상한액이고 실제 금액은 의뢰인과 개업공인중개사가 협의로 정한다
 *        (화면이 이 구분을 결과 바로 옆에서 안내한다).
 *        상한 요율·거래금액 구간·한도액·임대차 환산 배수·부가가치세율은 전부 DB 룰
 *        (brokerage.rates / brokerage.vat)에서 읽는다 — 코드에는 어떤 숫자도 없다.
 *        상한 요율은 시·도 조례로 정해져 지역별로 다를 수 있다: 룰 행 조건에 sido를 쓰면
 *        그 시·도 전용 행이 되고, sido 조건이 없는 행은 전국 공통이다(우선순위는 priority).
 *        룰이 없으면 0원으로 계산하지 않고 RULE_NOT_REGISTERED를 반환한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json, TaxRule, TaxRuleMode } from './types'
import type { AppliedRuleInfo, BrokerageInput, BrokerageResult, BrokerageSuccess, TaxEngineFailure } from './engine-types'
import { engineFail, fetchValidRules, isValidDateString, requireRule } from './rule-store'
import { parseBrokerageRates, parseBrokerageVat, selectRateRow } from './rule-value'

/** 중개수수료 룰 키 — 식별자일 뿐이며 값은 관리자가 DB에 등록한다 */
export const BROKERAGE_RULE_KEYS = {
  rates: 'brokerage.rates',   // 상한 요율표 (거래 유형·금액 구간·시·도 조건 + 한도액 + 임대차 환산)
  vat: 'brokerage.vat',       // 부가가치세율 (요율과 개정 주기가 달라 별도 키)
} as const

/** 룰 행을 결과 화면용 근거 정보로 변환 (취득세·인지세와 동일 형식) */
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
function validateInput(input: BrokerageInput): TaxEngineFailure | null {
  if (!isValidDateString(input.baseDate)) {
    return engineFail('INVALID_INPUT', '기준일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  }
  if (input.dealType !== 'sale_exchange' && input.dealType !== 'lease') {
    return engineFail('INVALID_INPUT', '거래 유형이 올바르지 않습니다.')
  }
  if (typeof input.sido !== 'string' || input.sido.trim() === '') {
    return engineFail('INVALID_INPUT', '소재지(시·도)를 선택해 주세요.')
  }
  if (input.dealType === 'sale_exchange') {
    if (!Number.isFinite(input.price) || (input.price as number) < 0) {
      return engineFail('INVALID_INPUT', '거래금액은 0 이상의 숫자여야 합니다.')
    }
  } else {
    if (!Number.isFinite(input.deposit) || (input.deposit as number) < 0) {
      return engineFail('INVALID_INPUT', '보증금은 0 이상의 숫자여야 합니다.')
    }
    if (!Number.isFinite(input.monthlyRent) || (input.monthlyRent as number) < 0) {
      return engineFail('INVALID_INPUT', '월세는 0 이상의 숫자여야 합니다. (월세가 없으면 0)')
    }
  }
  return null
}

/**
 * @함수명: calculateBrokerageCap
 * @설명: 중개보수 '상한액'을 계산합니다. 기준일에 유효한 요율표 룰(brokerage.rates)에서
 *        거래 유형·거래금액·시·도 조건에 맞는 행 하나를 골라 상한액(거래금액 × 상한요율,
 *        한도액 있으면 그 이하)을 구하고, 부가가치세(brokerage.vat)를 별도 금액으로 답합니다.
 *        임대차는 룰의 환산 방식(배수·기준액)으로 거래금액을 먼저 환산합니다.
 *        룰이 하나라도 없으면 0원 대신 실패(한국어 안내)를 반환합니다.
 * @매개변수: supabase - Supabase 클라이언트(서버) / input - 계산 입력 / mode - 룰 모드
 * @반환값: 성공(상한액 + 근거) 또는 실패(한국어 안내)
 */
export async function calculateBrokerageCap(
  supabase: SupabaseClient,
  input: BrokerageInput,
  mode: TaxRuleMode,
): Promise<BrokerageResult> {
  const inputError = validateInput(input)
  if (inputError) return inputError

  // 기준일에 유효한 룰 세트 로드 (모드 우선순위·충돌 검출은 취득세·인지세와 공용)
  const fetched = await fetchValidRules(supabase, 'brokerage', input.baseDate, mode)
  if (!fetched.ok) return fetched

  const ratesRule = requireRule(fetched.rules, BROKERAGE_RULE_KEYS.rates, input.baseDate)
  if (!ratesRule.ok) return ratesRule
  const table = parseBrokerageRates(ratesRule.rule.rule_value, ratesRule.rule.rule_key)
  if (!table.ok) return table

  const vatRule = requireRule(fetched.rules, BROKERAGE_RULE_KEYS.vat, input.baseDate)
  if (!vatRule.ok) return vatRule
  const vat = parseBrokerageVat(vatRule.rule.rule_value, vatRule.rule.rule_key)
  if (!vat.ok) return vat

  // ── 거래금액 확정 — 임대차는 룰의 환산 방식으로 보증금+월세를 환산한다 ──────
  let dealPrice: number
  let leaseConversion: BrokerageSuccess['leaseConversion'] = null
  if (input.dealType === 'lease') {
    const conv = table.value.leaseConversion
    const deposit = input.deposit as number
    const monthly = input.monthlyRent as number
    // 1차 환산액이 기준액 '미만'이면 대체 배수로 재환산 — 배수·기준액은 전부 룰 값
    const first = deposit + monthly * conv.multiplier
    if (conv.lowDeposit && first < conv.lowDeposit.thresholdAmount) {
      dealPrice = deposit + monthly * conv.lowDeposit.multiplier
      leaseConversion = { multiplierUsed: conv.lowDeposit.multiplier, usedLowDeposit: true }
    } else {
      dealPrice = first
      leaseConversion = { multiplierUsed: conv.multiplier, usedLowDeposit: false }
    }
  } else {
    dealPrice = input.price as number
  }

  // 판정 컨텍스트 — 요율표 행의 when 조건은 이 필드들만 쓸 수 있다 (전부 필수 입력이라 미확정 없음)
  const context: Record<string, Json | undefined> = {
    deal_type: input.dealType,   // 거래 유형 ('sale_exchange' / 'lease')
    price: dealPrice,            // 거래금액 (임대차는 환산액, 원)
    sido: input.sido,            // 소재지 시·도 이름 — 지역 조례 행 매칭용
  }
  const picked = selectRateRow(table.value.rows, context, ratesRule.rule.rule_key)
  if (!picked.ok) return picked

  // ── 상한액 = 거래금액 × 상한요율, 한도액이 있으면 그 이하. 1원 미만 버림 ────
  const raw = (dealPrice * picked.row.ratePercent) / 100
  const limitAmount = picked.row.limitAmount ?? null
  const limitApplied = limitAmount !== null && raw > limitAmount
  const capAmount = Math.floor(limitApplied ? (limitAmount as number) : raw)
  const vatAmount = Math.floor((capAmount * vat.value.ratePercent) / 100)

  const appliedRules = [toAppliedInfo(ratesRule.rule), toAppliedInfo(vatRule.rule)]
  return {
    ok: true,
    dealType: input.dealType,
    dealPrice,
    leaseConversion,
    capAmount,
    appliedRatePercent: picked.row.ratePercent,
    limitApplied,
    limitAmount,
    vatRatePercent: vat.value.ratePercent,
    vatAmount,
    appliedRules,
    ruleMode: mode,
    containsProposedRule: appliedRules.some((r) => r.status === 'proposed'),
  }
}
