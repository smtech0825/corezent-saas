'use server'

/**
 * @파일: tax/comprehensive/actions.ts
 * @설명: 종합부동산세 계산 서버 액션 — BotID 검증(공개 POST 남용 방지) → 엔진 호출,
 *        성공 시 tax_calculation_logs에 계산 이력을 기록한다.
 *        ⚠️ 개인식별정보(IP·이메일·이름)는 어떤 필드에도 기록하지 않는다.
 *        룰 조회는 공개 읽기(anon) 클라이언트, 이력 기록만 service_role 클라이언트를 쓴다.
 *        룰 모드는 화면이 선택한다(기본 확정법) — 개정안(proposed) 모드는 국회 통과 전
 *        개편안 룰을 포함해 계산하며, 개정안 전용 입력 4종도 그 모드에서만 전달된다.
 *        재산세 상당액 공제는 엔진이 재산세 엔진을 호출해 자동 계산한다(입력 없음).
 *        연도별 비교(includeYearComparison)는 본 계산 성공 시에만 부속으로 붙으며,
 *        비교 연도는 등록된 개정안 룰의 시행일에서 나온다(lib/tax/year-comparison.ts).
 */

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateComprehensiveTax } from '@/lib/tax/comprehensive'
import { runYearComparison } from '@/lib/tax/year-comparison'
import type { YearComparison } from '@/lib/tax/year-comparison'
import type { TaxRuleMode } from '@/lib/tax/types'
import type {
  ComprehensiveHouseCount,
  ComprehensiveInput,
  ComprehensiveResult,
  ComprehensiveSuccess,
} from '@/lib/tax/comprehensive-types'

/** 계산기 화면이 보내는 요청 — 주택 목록이 아니라 주택 수 + 공시가격 합계다 */
export interface ComprehensiveCalcPayload {
  ruleMode: TaxRuleMode                 // 확정법(confirmed) / 개정안 포함(proposed)
  taxYear: number                       // 과세연도 (YYYY)
  houseCount: ComprehensiveHouseCount   // 1 / 2 / 3(=3주택 이상)
  totalOfficialPrice: number            // 공시가격 합계 (원)
  isOneHouse: boolean                   // 1세대 1주택 여부 (주택 수 1일 때만)
  age?: number                          // 1세대 1주택 — 만 나이
  holdingYears?: number                 // 1세대 1주택 — 보유기간 (만 연수)
  prevTotalTax?: number                 // 직전 연도 총세액 (원) — 선택
  // ── 개정안 모드 전용(2026 세제개편안) — 확정법 모드 화면은 보내지 않는다 ──
  residenceYears?: number               // 1세대 1주택 — 거주기간 (만 연수)
  isResiding?: boolean                  // 1세대 1주택 — 해당 주택 거주 여부
  residingOfficialPrice?: number        // 다주택 — 거주 중인 주택의 공시가격 (비거주면 0)
  hasRegulatedHouse?: boolean           // 조정대상지역 주택 보유 여부 (자기신고)
  /** 연도별 비교 요청 — 선택 필드(보내지 않으면 비교 없이 기존과 동일 동작) */
  includeYearComparison?: boolean
  /**
   * 연도별 비교(개정안 해)에만 쓰는 개정안 전용 입력 — 확정법 모드에서 비교 화면이
   * 그 자리에서 받아 보낸다. ⚠️ 본 계산 입력에는 절대 얹지 않는다(확정법으로 계산한
   * 사람의 결과가 이 값 때문에 달라지면 안 된다).
   */
  comparisonProposedInputs?: ComparisonProposedInputs
}

/** 비교 전용 개정안 입력 — 개정안 룰의 행 조건·금액 산식이 요구하는 값들 */
export interface ComparisonProposedInputs {
  residenceYears?: number
  isResiding?: boolean
  residingOfficialPrice?: number
  hasRegulatedHouse?: boolean
}

/** 액션 응답 — 본 계산 결과 + (요청 시) 연도별 비교. 비교 실패는 본 결과 반환을 막지 않는다 */
export interface ComprehensiveCalcResponse {
  result: ComprehensiveResult
  /** includeYearComparison 요청·본 계산 성공·비교 성립(성공 1건 이상)일 때만 담긴다 */
  comparison?: YearComparison<ComprehensiveSuccess>
}

/**
 * @함수명: buildInput
 * @설명: 페이로드를 엔진 입력으로 변환합니다(본 계산용) — 타입·범위 검증은 엔진이 합니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 엔진 입력
 */
function buildInput(payload: ComprehensiveCalcPayload): ComprehensiveInput {
  return {
    taxYear: payload.taxYear,
    houseCount: payload.houseCount,
    totalOfficialPrice: payload.totalOfficialPrice,
    isOneHouse: payload.isOneHouse === true,
    age: payload.age,
    holdingYears: payload.holdingYears,
    prevTotalTax: payload.prevTotalTax,
    // 개정안 전용 입력 — 타입·범위 검증은 엔진이 수행한다(다른 필드와 같은 관례)
    residenceYears: payload.residenceYears,
    isResiding: payload.isResiding,
    residingOfficialPrice: payload.residingOfficialPrice,
    hasRegulatedHouse: payload.hasRegulatedHouse,
  }
}

/**
 * @함수명: buildComparisonInput
 * @설명: 연도별 비교용 엔진 입력 — 본 계산 입력에 비교 전용 개정안 입력만 얹습니다.
 *        본 계산은 이 값을 쓰지 않으므로 확정법 결과는 영향을 받지 않습니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 비교용 엔진 입력
 */
function buildComparisonInput(payload: ComprehensiveCalcPayload): ComprehensiveInput {
  const input = buildInput(payload)
  return payload.comparisonProposedInputs ? { ...input, ...payload.comparisonProposedInputs } : input
}

/**
 * @함수명: calculateComprehensiveComparison
 * @설명: 연도별 비교만 다시 계산합니다 — 확정법 모드 비교 화면이 개정안 전용 입력을
 *        받아 호출합니다. 본 계산은 하지 않고 이력도 남기지 않습니다(사용자가 실제로
 *        누른 본 계산 1건만 기록한다는 원칙).
 * @매개변수: payload - 본 계산에 쓴 페이로드 + comparisonProposedInputs
 * @반환값: 연도별 비교(성립하지 않으면 comparison 없음)
 */
export async function calculateComprehensiveComparison(
  payload: ComprehensiveCalcPayload,
): Promise<{ comparison?: YearComparison<ComprehensiveSuccess> }> {
  try {
    const botCheck = await checkBotId()
    if (botCheck.isBot) return {}
  } catch (err) {
    console.error('[tax] BotID 검증 실패(통과 처리):', err instanceof Error ? err.message : String(err))
  }

  const comparisonInput = buildComparisonInput(payload)
  const ruleMode: TaxRuleMode = payload.ruleMode === 'proposed' ? 'proposed' : 'confirmed'
  const supabase = await createClient()
  try {
    const comparison = await runYearComparison<ComprehensiveSuccess>(
      supabase,
      'comprehensive',
      comparisonInput.taxYear,
      ruleMode,
      (year, mode) => calculateComprehensiveTax(supabase, { ...comparisonInput, taxYear: year }, mode),
    )
    return comparison ? { comparison } : {}
  } catch (err) {
    console.error('[tax] 종합부동산세 비교 재계산 실패:', err instanceof Error ? err.message : String(err))
    return {}
  }
}

/**
 * @함수명: calculateComprehensive
 * @설명: 종합부동산세를 계산합니다. 룰이 없으면 0원 대신 실패 결과(한국어 안내)가 반환되고,
 *        그 경우 이력은 기록하지 않습니다. includeYearComparison 요청 시 본 계산이
 *        성공하면 연도별 비교(과세연도만 치환한 반복 계산)를 곁들여 반환합니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 본 계산 결과(성공: 과세 대상 여부+항목별 세액+근거 / 실패: 코드+안내문) + 선택적 연도별 비교
 */
export async function calculateComprehensive(payload: ComprehensiveCalcPayload): Promise<ComprehensiveCalcResponse> {
  // BotID 검증 — 다른 계산기 액션과 같은 관례(검증 자체 실패는 잡아서 통과 — 보호는 최선 노력)
  try {
    const botCheck = await checkBotId()
    if (botCheck.isBot) {
      return { result: { ok: false, code: 'INVALID_INPUT', message: '접근이 거부되었습니다. 잠시 후 다시 시도해 주세요.' } }
    }
  } catch (err) {
    console.error('[tax] BotID 검증 실패(통과 처리):', err instanceof Error ? err.message : String(err))
  }

  const input = buildInput(payload)

  // 알 수 없는 값은 확정법으로 강등 — 임의 문자열로 proposed가 열리는 것을 막는다(취득세와 동일)
  const ruleMode: TaxRuleMode = payload.ruleMode === 'proposed' ? 'proposed' : 'confirmed'
  const supabase = await createClient()
  const result = await calculateComprehensiveTax(supabase, input, ruleMode)

  if (result.ok) {
    // 계산 이력 기록 — 실패해도 계산 결과 반환은 막지 않는다 (다른 계산기와 같은 원칙)
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('tax_calculation_logs').insert({
        tax_type: 'comprehensive',
        base_date: result.baseDate,
        rule_mode: ruleMode,
        input,
        output: {
          taxable: result.taxable,
          notTaxableReason: result.notTaxableReason,
          basicDeductionApplied: result.basicDeductionApplied,
          basicDeductionType: result.basicDeductionType,
          basicDeductionLabel: result.basicDeductionLabel,
          taxBase: result.taxBase,
          heavyTableApplied: result.heavyTableApplied,
          taxCredit: result.taxCredit,
          burdenCap: result.burdenCap,
          breakdown: result.breakdown,
          containsProposedRule: result.containsProposedRule,
          unresolvedFields: result.unresolvedFields,
        },
        applied_rule_ids: result.appliedRules.map((r) => r.id),
      })
      if (error) console.error('[tax] 종합부동산세 이력 기록 실패:', error.message)
    } catch (err) {
      console.error('[tax] 종합부동산세 이력 기록 실패:', err instanceof Error ? err.message : String(err))
    }
  }

  // 연도별 비교 — 요청 시·본 계산 성공 시에만 곁들인다. 비교할 연도는 등록된 개정안 룰의
  // 시행일에서 나오고(코드에 연도 없음), 기준 연도(올해 KST)=확정법·이후 해=개정안 모드로
  // 과세연도만 치환해 계산한다(과세기준일 산출은 엔진이 룰에서 한다). 부속 호출이라 이력은
  // 남기지 않으며(위 기록은 본 계산 1건뿐), 비교가 실패해도 본 결과 반환은 막지 않는다.
  let comparison: YearComparison<ComprehensiveSuccess> | undefined
  if (payload.includeYearComparison === true && result.ok) {
    try {
      const comparisonInput = buildComparisonInput(payload)
      comparison =
        (await runYearComparison<ComprehensiveSuccess>(
          supabase,
          'comprehensive',
          input.taxYear,
          ruleMode,
          (year, mode) => calculateComprehensiveTax(supabase, { ...comparisonInput, taxYear: year }, mode),
        )) ?? undefined
    } catch (err) {
      console.error('[tax] 종합부동산세 연도별 비교 실패(본 결과만 반환):', err instanceof Error ? err.message : String(err))
    }
  }

  return { result, comparison }
}
