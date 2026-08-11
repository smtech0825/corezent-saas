'use server'

/**
 * @파일: tax/acquisition/actions.ts
 * @설명: 취득세 계산 서버 액션 — BotID 검증(공개 POST 남용 방지) → 소재지 검증(목록 밖
 *        값 차단) → 엔진 호출, 성공 시 tax_calculation_logs에 계산 이력을 기록한다.
 *        ⚠️ 개인식별정보(IP·이메일·이름)는 어떤 필드에도 기록하지 않는다.
 *        룰 조회는 공개 읽기(anon) 클라이언트, 이력 기록만 service_role 클라이언트를 쓴다.
 */

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateAcquisitionTax } from '@/lib/tax/acquisition'
import { buildRegionCode, isKnownRegion } from '@/lib/tax/regions'
import type { AcquisitionCause, AcquisitionInput, AcquisitionResult, DonorRelation } from '@/lib/tax/engine-types'
import type { TaxRuleMode } from '@/lib/tax/types'

/** 계산기 화면이 보내는 요청 — 소재지는 코드가 아니라 이름(시·도/시·군·구)으로 받아 서버가 검증·조립 */
export interface AcquisitionCalcPayload {
  baseDate: string
  sido: string
  sigungu: string
  cause: AcquisitionCause
  price: number
  houseCountAfter: number
  areaOver85: boolean
  ruleMode: TaxRuleMode
  firstHome?: boolean
  temporaryTwoHome?: boolean
  donorRelation?: DonorRelation
  marketValue?: number
  officialPrice?: number
  donorIsSingleHomeOwner?: boolean
}

/**
 * @함수명: calculateAcquisition
 * @설명: 취득세를 계산합니다. 룰이 없으면 0원 대신 실패 결과(한국어 안내)가 반환되고,
 *        그 경우 이력은 기록하지 않습니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 엔진 결과 (성공: 세액 분해+근거 / 실패: 코드+안내문)
 */
export async function calculateAcquisition(payload: AcquisitionCalcPayload): Promise<AcquisitionResult> {
  // BotID 검증 — 봇으로 판별되면 즉시 차단 (/api/contact와 같은 공개 POST 보호 관례).
  // 검증 자체가 실패(토큰 부재·네트워크 순단)하면 예외가 서버 액션 밖으로 새어
  // 페이지 전체가 에러 화면으로 교체되므로, 잡아서 통과시킨다(보호는 최선 노력).
  try {
    const botCheck = await checkBotId()
    if (botCheck.isBot) {
      return { ok: false, code: 'INVALID_INPUT', message: '접근이 거부되었습니다. 잠시 후 다시 시도해 주세요.' }
    }
  } catch (err) {
    console.error('[tax] BotID 검증 실패(통과 처리):', err instanceof Error ? err.message : String(err))
  }

  // 소재지는 행정구역 목록에 있는 조합만 허용 — 주소 직접 입력(임의 문자열) 차단
  if (!isKnownRegion(payload.sido, payload.sigungu)) {
    return { ok: false, code: 'INVALID_INPUT', message: '소재지는 목록에서 선택해 주세요.' }
  }
  const ruleMode: TaxRuleMode = payload.ruleMode === 'proposed' ? 'proposed' : 'confirmed'

  const input: AcquisitionInput = {
    baseDate: payload.baseDate,
    regionCode: buildRegionCode(payload.sido, payload.sigungu),
    cause: payload.cause === 'gift' ? 'gift' : 'sale',
    price: payload.price,
    houseCountAfter: payload.houseCountAfter,
    areaOver85: payload.areaOver85 === true,
    firstHome: payload.firstHome === true,
    temporaryTwoHome: payload.temporaryTwoHome === true,
    donorRelation: payload.donorRelation,
    marketValue: payload.marketValue,
    officialPrice: payload.officialPrice,
    donorIsSingleHomeOwner: payload.donorIsSingleHomeOwner,
  }

  const supabase = await createClient()
  const result = await calculateAcquisitionTax(supabase, input, ruleMode)

  if (result.ok) {
    // 계산 이력 기록 — 실패해도 계산 결과 반환은 막지 않는다 (메일 실패 시 주 흐름 진행과 같은 원칙)
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('tax_calculation_logs').insert({
        tax_type: 'acquisition',
        base_date: input.baseDate,
        rule_mode: ruleMode,
        input,
        output: {
          causeApplied: result.causeApplied,
          deemedGift: result.deemedGift,
          taxBase: result.taxBase,
          isRegulatedArea: result.isRegulatedArea,
          breakdown: result.breakdown,
          containsProposedRule: result.containsProposedRule,
        },
        applied_rule_ids: result.appliedRules.map((r) => r.id),
      })
      if (error) console.error('[tax] 계산 이력 기록 실패:', error.message)
    } catch (err) {
      console.error('[tax] 계산 이력 기록 실패:', err instanceof Error ? err.message : String(err))
    }
  }

  return result
}
