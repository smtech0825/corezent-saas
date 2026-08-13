'use server'

/**
 * @파일: tax/brokerage/actions.ts
 * @설명: 중개수수료 상한 계산 서버 액션 — BotID 검증(공개 POST 남용 방지) → 소재지(시·도)
 *        목록 검증 → 엔진 호출, 성공 시 tax_calculation_logs에 계산 이력을 기록한다.
 *        ⚠️ 개인식별정보(IP·이메일·이름)는 어떤 필드에도 기록하지 않는다.
 *        룰 조회는 공개 읽기(anon) 클라이언트, 이력 기록만 service_role 클라이언트를 쓴다.
 *        룰 모드는 확정법(confirmed) 고정 — 인지세와 같은 관례(화면에 모드 토글 없음).
 */

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateBrokerageCap } from '@/lib/tax/brokerage'
import { isKnownSido } from '@/lib/tax/regions'
import type { BrokerageDealType, BrokerageInput, BrokerageResult } from '@/lib/tax/engine-types'

/** 계산기 화면이 보내는 요청 */
export interface BrokerageCalcPayload {
  baseDate: string              // 기준일 (YYYY-MM-DD)
  dealType: BrokerageDealType   // 매매·교환 / 임대차
  sido: string                  // 소재지 시·도 이름
  price?: number                // 매매·교환 — 거래금액 (원)
  deposit?: number              // 임대차 — 보증금 (원)
  monthlyRent?: number          // 임대차 — 월세 (원)
}

/**
 * @함수명: calculateBrokerage
 * @설명: 중개보수 상한액을 계산합니다. 룰이 없으면 0원 대신 실패 결과(한국어 안내)가
 *        반환되고, 그 경우 이력은 기록하지 않습니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 엔진 결과 (성공: 상한액+근거 / 실패: 코드+안내문)
 */
export async function calculateBrokerage(payload: BrokerageCalcPayload): Promise<BrokerageResult> {
  // BotID 검증 — 취득세·인지세 액션과 같은 관례(검증 자체 실패는 잡아서 통과 — 보호는 최선 노력)
  try {
    const botCheck = await checkBotId()
    if (botCheck.isBot) {
      return { ok: false, code: 'INVALID_INPUT', message: '접근이 거부되었습니다. 잠시 후 다시 시도해 주세요.' }
    }
  } catch (err) {
    console.error('[tax] BotID 검증 실패(통과 처리):', err instanceof Error ? err.message : String(err))
  }

  // 소재지는 행정구역 목록의 시·도만 허용 — 임의 문자열 차단
  if (!isKnownSido(payload.sido)) {
    return { ok: false, code: 'INVALID_INPUT', message: '소재지(시·도)는 목록에서 선택해 주세요.' }
  }

  const input: BrokerageInput = {
    baseDate: payload.baseDate,
    dealType: payload.dealType === 'lease' ? 'lease' : 'sale_exchange',
    sido: payload.sido,
    price: payload.price,
    deposit: payload.deposit,
    monthlyRent: payload.monthlyRent,
  }

  const supabase = await createClient()
  const result = await calculateBrokerageCap(supabase, input, 'confirmed')

  if (result.ok) {
    // 계산 이력 기록 — 실패해도 계산 결과 반환은 막지 않는다 (취득세·인지세와 같은 원칙)
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('tax_calculation_logs').insert({
        tax_type: 'brokerage',
        base_date: input.baseDate,
        rule_mode: 'confirmed',
        input,
        output: {
          dealType: result.dealType,
          dealPrice: result.dealPrice,
          leaseConversion: result.leaseConversion,
          capAmount: result.capAmount,
          appliedRatePercent: result.appliedRatePercent,
          limitApplied: result.limitApplied,
          limitAmount: result.limitAmount,
          vatRatePercent: result.vatRatePercent,
          vatAmount: result.vatAmount,
          containsProposedRule: result.containsProposedRule,
        },
        applied_rule_ids: result.appliedRules.map((r) => r.id),
      })
      if (error) console.error('[tax] 중개수수료 이력 기록 실패:', error.message)
    } catch (err) {
      console.error('[tax] 중개수수료 이력 기록 실패:', err instanceof Error ? err.message : String(err))
    }
  }

  return result
}
