'use server'

/**
 * @파일: tax/registration/actions.ts
 * @설명: 등기비용 계산 서버 액션 — BotID 검증(공개 POST 남용 방지) → 소재지 목록 검증 →
 *        엔진 호출, 성공 시 tax_calculation_logs에 계산 이력을 기록한다.
 *        ⚠️ 개인식별정보(IP·이메일·이름)는 어떤 필드에도 기록하지 않는다.
 *        룰 조회는 공개 읽기(anon) 클라이언트, 이력 기록만 service_role 클라이언트를 쓴다.
 *        룰 모드는 확정법(confirmed) 고정 — 개편안(미확정)은 이 계산기의 제외 범위다.
 *        취득세·인지세는 엔진이 내부에서 기존 엔진을 호출해 구한다(입력·이력 모두 이 액션 하나).
 */

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateRegistrationCost } from '@/lib/tax/registration'
import { buildRegionCode, isKnownRegion } from '@/lib/tax/regions'
import type { RegistrationInput, RegistrationResult } from '@/lib/tax/registration-types'

/** 계산기 화면이 보내는 요청 — 소재지는 이름으로 받아 서버가 검증·조립한다 */
export interface RegistrationCalcPayload {
  baseDate: string           // 취득일 (YYYY-MM-DD)
  sido: string
  sigungu: string
  price: number              // 취득가액 (원)
  officialPrice: number      // 시가표준액(공시가격, 원) — 채권 매입액 기준이라 필수
  houseCountAfter: number    // 취득 후 주택 수
  areaSqm?: number           // 전용면적 (㎡)
  firstHome?: boolean        // 생애최초 취득
  temporaryTwoHome?: boolean // 일시적 2주택
  bondLossPercent?: number   // 채권 즉시매도 손실률(%) — 비우면 채권 항목 미포함
  judicialFee?: number       // 법무사 보수(원) — 비우면 미포함
}

/**
 * @함수명: calculateRegistration
 * @설명: 등기비용을 계산합니다. 룰이 없거나 호출한 엔진(취득세·인지세)이 실패하면
 *        0원 대신 실패 결과(한국어 안내)가 반환되고, 그 경우 이력은 기록하지 않습니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 엔진 결과 (성공: 항목별 금액+포함 여부+근거 / 실패: 코드+안내문)
 */
export async function calculateRegistration(payload: RegistrationCalcPayload): Promise<RegistrationResult> {
  // BotID 검증 — 다른 계산기 액션과 같은 관례(검증 자체 실패는 잡아서 통과 — 보호는 최선 노력)
  try {
    const botCheck = await checkBotId()
    if (botCheck.isBot) {
      return { ok: false, code: 'INVALID_INPUT', message: '접근이 거부되었습니다. 잠시 후 다시 시도해 주세요.' }
    }
  } catch (err) {
    console.error('[tax] BotID 검증 실패(통과 처리):', err instanceof Error ? err.message : String(err))
  }

  // 소재지는 행정구역 목록에 있는 조합만 허용 — 임의 문자열 차단
  if (!isKnownRegion(payload.sido, payload.sigungu)) {
    return { ok: false, code: 'INVALID_INPUT', message: '소재지는 목록에서 선택해 주세요.' }
  }

  const input: RegistrationInput = {
    baseDate: payload.baseDate,
    regionCode: buildRegionCode(payload.sido, payload.sigungu),
    sido: payload.sido,
    price: payload.price,
    officialPrice: payload.officialPrice,
    houseCountAfter: payload.houseCountAfter,
    areaSqm: payload.areaSqm,
    firstHome: payload.firstHome === true,
    temporaryTwoHome: payload.temporaryTwoHome === true,
    bondLossPercent: payload.bondLossPercent,
    judicialFee: payload.judicialFee,
  }

  const supabase = await createClient()
  const result = await calculateRegistrationCost(supabase, input, 'confirmed')

  if (result.ok) {
    // 계산 이력 기록 — 실패해도 계산 결과 반환은 막지 않는다 (다른 계산기와 같은 원칙)
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('tax_calculation_logs').insert({
        tax_type: 'registration',
        base_date: input.baseDate,
        rule_mode: 'confirmed',
        input,
        output: {
          breakdown: result.breakdown,
          someExcluded: result.someExcluded,
          feeMethodLabel: result.feeMethodLabel,
          bond: result.bond,
          stampExempt: result.stampExempt,
          isRegulatedArea: result.isRegulatedArea,
          containsProposedRule: result.containsProposedRule,
          unresolvedFields: result.unresolvedFields,
        },
        applied_rule_ids: result.appliedRules.map((r) => r.id),
      })
      if (error) console.error('[tax] 등기비용 이력 기록 실패:', error.message)
    } catch (err) {
      console.error('[tax] 등기비용 이력 기록 실패:', err instanceof Error ? err.message : String(err))
    }
  }

  return result
}
