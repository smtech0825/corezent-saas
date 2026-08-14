'use server'

/**
 * @파일: tax/property/actions.ts
 * @설명: 재산세 계산 서버 액션 — BotID 검증(공개 POST 남용 방지) → 엔진 호출,
 *        성공 시 tax_calculation_logs에 계산 이력을 기록한다.
 *        ⚠️ 개인식별정보(IP·이메일·이름)는 어떤 필드에도 기록하지 않는다.
 *        룰 조회는 공개 읽기(anon) 클라이언트, 이력 기록만 service_role 클라이언트를 쓴다.
 *        룰 모드는 확정법(confirmed) 고정 — 개편안(미확정)은 이 계산기의 제외 범위다.
 *        이력의 base_date는 엔진이 룰(과세기준일 월·일)과 과세연도로 산출한 날짜를 쓴다.
 */

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePropertyTax } from '@/lib/tax/property'
import type { PropertyInput, PropertyResult } from '@/lib/tax/property-types'

/** 계산기 화면이 보내는 요청 — 직전 연도 값 2종은 선택(비우면 상한 미적용) */
export interface PropertyCalcPayload {
  taxYear: number          // 과세연도 (YYYY)
  officialPrice: number    // 공시가격 (원)
  isOneHouse: boolean      // 1세대 1주택 여부
  isUrbanArea: boolean     // 도시지역 여부 (기본 해당)
  prevTaxBase?: number     // 직전 연도 과세표준 (원)
  prevTaxAmount?: number   // 직전 연도 재산세액(본세, 원)
}

/**
 * @함수명: calculateProperty
 * @설명: 재산세를 계산합니다. 룰이 없으면 0원 대신 실패 결과(한국어 안내)가 반환되고,
 *        그 경우 이력은 기록하지 않습니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 엔진 결과 (성공: 항목별 세액+근거 / 실패: 코드+안내문)
 */
export async function calculateProperty(payload: PropertyCalcPayload): Promise<PropertyResult> {
  // BotID 검증 — 다른 계산기 액션과 같은 관례(검증 자체 실패는 잡아서 통과 — 보호는 최선 노력)
  try {
    const botCheck = await checkBotId()
    if (botCheck.isBot) {
      return { ok: false, code: 'INVALID_INPUT', message: '접근이 거부되었습니다. 잠시 후 다시 시도해 주세요.' }
    }
  } catch (err) {
    console.error('[tax] BotID 검증 실패(통과 처리):', err instanceof Error ? err.message : String(err))
  }

  const input: PropertyInput = {
    taxYear: payload.taxYear,
    officialPrice: payload.officialPrice,
    isOneHouse: payload.isOneHouse === true,
    isUrbanArea: payload.isUrbanArea === true,
    prevTaxBase: payload.prevTaxBase,
    prevTaxAmount: payload.prevTaxAmount,
  }

  const supabase = await createClient()
  const result = await calculatePropertyTax(supabase, input, 'confirmed')

  if (result.ok) {
    // 계산 이력 기록 — 실패해도 계산 결과 반환은 막지 않는다 (다른 계산기와 같은 원칙)
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('tax_calculation_logs').insert({
        tax_type: 'property',
        base_date: result.baseDate,
        rule_mode: 'confirmed',
        input,
        output: {
          taxBaseBeforeCap: result.taxBaseBeforeCap,
          taxBase: result.taxBase,
          assessmentRatioPercent: result.assessmentRatioPercent,
          assessmentRatioType: result.assessmentRatioType,
          rateTable: result.rateTable,
          baseCap: result.baseCap,
          burdenCap: result.burdenCap,
          urbanAreaIncluded: result.urbanAreaIncluded,
          breakdown: result.breakdown,
          containsProposedRule: result.containsProposedRule,
          unresolvedFields: result.unresolvedFields,
        },
        applied_rule_ids: result.appliedRules.map((r) => r.id),
      })
      if (error) console.error('[tax] 재산세 이력 기록 실패:', error.message)
    } catch (err) {
      console.error('[tax] 재산세 이력 기록 실패:', err instanceof Error ? err.message : String(err))
    }
  }

  return result
}
