/**
 * @파일: lib/tax/stamp.ts
 * @설명: 인지세 계산기 — 부동산 계약서(1통 기준)에 붙는 정액 세금.
 *        계약 당사자가 여럿이어도 계약서 한 통에는 한 번만 과세되므로 이 엔진은
 *        항상 1통 기준으로 계산한다(여러 통 작성은 반영하지 않는다 — 화면이 안내).
 *        엔진은 금액을 모른다: 세액표·구간·비과세 기준은 전부 DB 룰(stamp.rates)에서
 *        읽고, 조건 평가는 취득세와 같은 방식(eq/min/max/in·priority)을 재사용한다.
 *        룰이 없으면 0원으로 계산하지 않고 RULE_NOT_REGISTERED를 반환한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json, TaxRule, TaxRuleMode } from './types'
import type { AppliedRuleInfo, StampInput, StampResult, TaxEngineFailure } from './engine-types'
import { engineFail, fetchValidRules, isValidDateString, requireRule } from './rule-store'
import { parseStampRates, selectRateRow } from './rule-value'

/** 인지세 룰 키 — 식별자일 뿐이며 값은 관리자가 DB에 등록한다 */
export const STAMP_RULE_KEYS = {
  rates: 'stamp.rates',   // 인지세 세액표 (계약금액 구간별 정액 + 비과세 행)
} as const

/** 룰 행을 결과 화면용 근거 정보로 변환 (취득세와 동일 형식) */
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
function validateInput(input: StampInput): TaxEngineFailure | null {
  if (!isValidDateString(input.baseDate)) {
    return engineFail('INVALID_INPUT', '계약일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  }
  if (!Number.isFinite(input.contractPrice) || input.contractPrice < 0) {
    return engineFail('INVALID_INPUT', '계약금액은 0 이상의 숫자여야 합니다.')
  }
  if (typeof input.isHousing !== 'boolean') {
    return engineFail('INVALID_INPUT', '주택 여부가 올바르지 않습니다.')
  }
  return null
}

/**
 * @함수명: calculateStampTax
 * @설명: 인지세를 계산합니다. 계약일 시점에 유효한 세액표 룰(stamp.rates)에서
 *        계약금액·주택 여부 조건에 맞는 행 하나를 골라 정액 세액을 반환합니다.
 *        비과세 행(amount 0)이 선택되면 사유(exemptReason)를 함께 반환해
 *        화면이 "왜 세금이 없는지"를 표시할 수 있게 합니다.
 * @매개변수: supabase - Supabase 클라이언트(서버) / input - 계산 입력 / mode - 룰 모드
 * @반환값: 성공(세액 + 근거) 또는 실패(한국어 안내)
 */
export async function calculateStampTax(
  supabase: SupabaseClient,
  input: StampInput,
  mode: TaxRuleMode,
): Promise<StampResult> {
  const inputError = validateInput(input)
  if (inputError) return inputError

  // 계약일에 유효한 룰 세트 로드 (모드 우선순위·충돌 검출은 취득세와 공용)
  const fetched = await fetchValidRules(supabase, 'stamp', input.baseDate, mode)
  if (!fetched.ok) return fetched

  const ratesRule = requireRule(fetched.rules, STAMP_RULE_KEYS.rates, input.baseDate)
  if (!ratesRule.ok) return ratesRule
  const table = parseStampRates(ratesRule.rule.rule_value, ratesRule.rule.rule_key)
  if (!table.ok) return table

  // 판정 컨텍스트 — 세액표 행의 when 조건은 이 필드들만 쓸 수 있다 (둘 다 필수 입력이라 미확정 없음)
  const context: Record<string, Json | undefined> = {
    price: input.contractPrice,   // 계약서 기재금액 (원)
    is_housing: input.isHousing,  // 주택 여부
  }
  const picked = selectRateRow(table.rows, context, ratesRule.rule.rule_key)
  if (!picked.ok) return picked

  const appliedRules = [toAppliedInfo(ratesRule.rule)]
  const exempt = picked.row.amount === 0
  return {
    ok: true,
    amount: picked.row.amount,
    exempt,
    exemptReason: exempt ? (picked.row.exemptReason ?? null) : null,
    appliedRules,
    ruleMode: mode,
    containsProposedRule: appliedRules.some((r) => r.status === 'proposed'),
  }
}
