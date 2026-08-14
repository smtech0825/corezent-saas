'use server'

/**
 * @파일: tax/comprehensive/actions.ts
 * @설명: 종합부동산세 계산 서버 액션 — BotID 검증(공개 POST 남용 방지) → 엔진 호출,
 *        성공 시 tax_calculation_logs에 계산 이력을 기록한다.
 *        ⚠️ 개인식별정보(IP·이메일·이름)는 어떤 필드에도 기록하지 않는다.
 *        룰 조회는 공개 읽기(anon) 클라이언트, 이력 기록만 service_role 클라이언트를 쓴다.
 *        룰 모드는 확정법(confirmed) 고정 — 개편안(미확정)은 이 계산기의 제외 범위다.
 *        재산세 상당액 공제는 엔진이 재산세 엔진을 호출해 자동 계산한다(입력 없음).
 */

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateComprehensiveTax } from '@/lib/tax/comprehensive'
import type {
  ComprehensiveHouseCount,
  ComprehensiveInput,
  ComprehensiveResult,
} from '@/lib/tax/comprehensive-types'

/** 계산기 화면이 보내는 요청 — 주택 목록이 아니라 주택 수 + 공시가격 합계다 */
export interface ComprehensiveCalcPayload {
  taxYear: number                       // 과세연도 (YYYY)
  houseCount: ComprehensiveHouseCount   // 1 / 2 / 3(=3주택 이상)
  totalOfficialPrice: number            // 공시가격 합계 (원)
  isOneHouse: boolean                   // 1세대 1주택 여부 (주택 수 1일 때만)
  age?: number                          // 1세대 1주택 — 만 나이
  holdingYears?: number                 // 1세대 1주택 — 보유기간 (만 연수)
  prevTotalTax?: number                 // 직전 연도 총세액 (원) — 선택
}

/**
 * @함수명: calculateComprehensive
 * @설명: 종합부동산세를 계산합니다. 룰이 없으면 0원 대신 실패 결과(한국어 안내)가 반환되고,
 *        그 경우 이력은 기록하지 않습니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 엔진 결과 (성공: 과세 대상 여부+항목별 세액+근거 / 실패: 코드+안내문)
 */
export async function calculateComprehensive(payload: ComprehensiveCalcPayload): Promise<ComprehensiveResult> {
  // BotID 검증 — 다른 계산기 액션과 같은 관례(검증 자체 실패는 잡아서 통과 — 보호는 최선 노력)
  try {
    const botCheck = await checkBotId()
    if (botCheck.isBot) {
      return { ok: false, code: 'INVALID_INPUT', message: '접근이 거부되었습니다. 잠시 후 다시 시도해 주세요.' }
    }
  } catch (err) {
    console.error('[tax] BotID 검증 실패(통과 처리):', err instanceof Error ? err.message : String(err))
  }

  const input: ComprehensiveInput = {
    taxYear: payload.taxYear,
    houseCount: payload.houseCount,
    totalOfficialPrice: payload.totalOfficialPrice,
    isOneHouse: payload.isOneHouse === true,
    age: payload.age,
    holdingYears: payload.holdingYears,
    prevTotalTax: payload.prevTotalTax,
  }

  const supabase = await createClient()
  const result = await calculateComprehensiveTax(supabase, input, 'confirmed')

  if (result.ok) {
    // 계산 이력 기록 — 실패해도 계산 결과 반환은 막지 않는다 (다른 계산기와 같은 원칙)
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('tax_calculation_logs').insert({
        tax_type: 'comprehensive',
        base_date: result.baseDate,
        rule_mode: 'confirmed',
        input,
        output: {
          taxable: result.taxable,
          notTaxableReason: result.notTaxableReason,
          basicDeductionApplied: result.basicDeductionApplied,
          basicDeductionType: result.basicDeductionType,
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

  return result
}
