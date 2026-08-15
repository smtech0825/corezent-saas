'use server'

/**
 * @파일: tax/net-proceeds/actions.ts
 * @설명: 매도 실수령액 계산 서버 액션 — BotID 검증(공개 POST 남용 방지) → 소재지 목록
 *        검증 → 엔진 호출, 성공 시 tax_calculation_logs에 계산 이력을 기록한다.
 *        ⚠️ 이력의 tax_type은 'transfer'다 — 실수령액은 양도소득세 계산을 다르게 보여주는
 *        것이지 별개 세목이 아니다. 구분은 input의 calculator 표시로 남긴다.
 *        ⚠️ 개인식별정보(IP·이메일·이름)는 어떤 필드에도 기록하지 않는다.
 *        룰 모드는 확정법(confirmed) 고정 — 개편안(미확정)은 이 계산기의 제외 범위다.
 */

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateNetProceeds } from '@/lib/tax/net-proceeds'
import { buildRegionCode, isKnownRegion } from '@/lib/tax/regions'
import type { NetProceedsInput, NetProceedsResult } from '@/lib/tax/net-proceeds-types'
import type { TransferCalcPayload } from '../transfer/actions'

/** 계산기 화면이 보내는 요청 — 양도세 계산기 요청 + 실제 중개수수료·그 밖의 비용 */
export interface NetProceedsCalcPayload extends TransferCalcPayload {
  actualBrokerageFee?: number   // 실제 중개수수료(원, 부가세 포함) — 비우면 법정 상한액 사용
  otherCosts?: number           // 그 밖의 비용(원) — 수리비·이사비 등
}

/**
 * @함수명: calculateNetProceedsAction
 * @설명: 매도 실수령액을 계산합니다. 양도세·중개수수료 엔진이 실패하면 0원 대신
 *        실패 결과(한국어 안내)가 반환되고, 그 경우 이력은 기록하지 않습니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 엔진 결과 (성공: 실수령액+차감 분해+근거 / 실패: 코드+안내문)
 */
export async function calculateNetProceedsAction(payload: NetProceedsCalcPayload): Promise<NetProceedsResult> {
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

  const input: NetProceedsInput = {
    baseDate: payload.transferDate,
    acquiredAt: payload.acquiredAt,
    regionCode: buildRegionCode(payload.sido, payload.sigungu),
    sido: payload.sido,
    sigungu: payload.sigungu,
    transferPrice: payload.transferPrice,
    acquirePrice: payload.acquirePrice,
    expenses: payload.expenses,
    houseCount: payload.houseCount,
    residenceYears: payload.residenceYears,
    acquiredInRegulatedArea: payload.acquiredInRegulatedArea,
    isTemporaryTwoHouse: payload.isTemporaryTwoHouse === true,
    newHouseAcquiredAt: payload.newHouseAcquiredAt,
    inherited: payload.inherited === true,
    inheritanceOpenedAt: payload.inheritanceOpenedAt,
    decedentAcquiredAt: payload.decedentAcquiredAt,
    graceContractDate: payload.graceContractDate,
    graceDepositReceived: payload.graceDepositReceived,
    actualBrokerageFee: payload.actualBrokerageFee,
    otherCosts: payload.otherCosts,
  }

  const supabase = await createClient()
  const result = await calculateNetProceeds(supabase, input, 'confirmed')

  if (result.ok) {
    // 계산 이력 기록 — 실패해도 계산 결과 반환은 막지 않는다 (다른 계산기와 같은 원칙).
    // 세목은 transfer(별개 세목이 아님), 어느 계산기인지는 input.calculator로 구분한다.
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('tax_calculation_logs').insert({
        tax_type: 'transfer',
        base_date: input.baseDate,
        rule_mode: 'confirmed',
        input: { calculator: 'net_proceeds', ...input },
        output: {
          breakdown: result.breakdown,
          brokerage: result.brokerage,
          transferExempt: result.transfer.exempt,
          transferExemptReason: result.transfer.exemptReason,
          heavyApplied: result.transfer.heavyApplied,
          regulatedAtTransferPartial: result.transfer.regulatedAtTransferPartial,
          // 비과세 거주 요건을 가른 값과 근거 — 양도세 이력과 같은 이유로 남긴다
          acquiredRegulated: result.transfer.acquiredRegulated,
          containsProposedRule: result.containsProposedRule,
          unresolvedFields: result.unresolvedFields,
        },
        applied_rule_ids: result.appliedRules.map((r) => r.id),
      })
      if (error) console.error('[tax] 실수령액 이력 기록 실패:', error.message)
    } catch (err) {
      console.error('[tax] 실수령액 이력 기록 실패:', err instanceof Error ? err.message : String(err))
    }
  }

  return result
}
