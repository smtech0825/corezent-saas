'use server'

/**
 * @파일: tax/stamp/actions.ts
 * @설명: 인지세 계산 서버 액션 — BotID 검증(공개 POST 남용 방지) → 엔진 호출,
 *        성공 시 tax_calculation_logs에 계산 이력을 기록한다(058 적용 필요).
 *        ⚠️ 개인식별정보(IP·이메일·이름)는 어떤 필드에도 기록하지 않는다.
 *        룰 조회는 공개 읽기(anon) 클라이언트, 이력 기록만 service_role 클라이언트를 쓴다.
 *        룰 모드는 확정법(confirmed) 고정 — 인지세 화면에는 모드 토글이 없다.
 */

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateStampTax } from '@/lib/tax/stamp'
import type { StampInput, StampResult } from '@/lib/tax/engine-types'

/** 계산기 화면이 보내는 요청 */
export interface StampCalcPayload {
  contractDate: string    // 계약일 (YYYY-MM-DD)
  contractPrice: number   // 계약서 기재금액 (원)
  isHousing: boolean      // 주택 여부
}

/**
 * @함수명: calculateStamp
 * @설명: 인지세를 계산합니다. 룰이 없으면 0원 대신 실패 결과(한국어 안내)가 반환되고,
 *        그 경우 이력은 기록하지 않습니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 엔진 결과 (성공: 세액+근거 / 실패: 코드+안내문)
 */
export async function calculateStamp(payload: StampCalcPayload): Promise<StampResult> {
  // BotID 검증 — 취득세 액션과 같은 관례(검증 자체 실패는 잡아서 통과 — 보호는 최선 노력)
  try {
    const botCheck = await checkBotId()
    if (botCheck.isBot) {
      return { ok: false, code: 'INVALID_INPUT', message: '접근이 거부되었습니다. 잠시 후 다시 시도해 주세요.' }
    }
  } catch (err) {
    console.error('[tax] BotID 검증 실패(통과 처리):', err instanceof Error ? err.message : String(err))
  }

  const input: StampInput = {
    baseDate: payload.contractDate,
    contractPrice: payload.contractPrice,
    isHousing: payload.isHousing === true,
  }

  const supabase = await createClient()
  const result = await calculateStampTax(supabase, input, 'confirmed')

  if (result.ok) {
    // 계산 이력 기록 — 실패해도 계산 결과 반환은 막지 않는다 (취득세와 같은 원칙)
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('tax_calculation_logs').insert({
        tax_type: 'stamp',
        base_date: input.baseDate,
        rule_mode: 'confirmed',
        input,
        output: {
          amount: result.amount,
          exempt: result.exempt,
          exemptReason: result.exemptReason,
          containsProposedRule: result.containsProposedRule,
        },
        applied_rule_ids: result.appliedRules.map((r) => r.id),
      })
      if (error) console.error('[tax] 인지세 이력 기록 실패:', error.message)
    } catch (err) {
      console.error('[tax] 인지세 이력 기록 실패:', err instanceof Error ? err.message : String(err))
    }
  }

  return result
}
