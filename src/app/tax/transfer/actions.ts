'use server'

/**
 * @파일: tax/transfer/actions.ts
 * @설명: 양도소득세 계산 서버 액션 — BotID 검증(공개 POST 남용 방지) → 소재지 목록 검증 →
 *        엔진 호출, 성공 시 tax_calculation_logs에 계산 이력을 기록한다.
 *        ⚠️ 개인식별정보(IP·이메일·이름)는 어떤 필드에도 기록하지 않는다.
 *        룰 조회는 공개 읽기(anon) 클라이언트, 이력 기록만 service_role 클라이언트를 쓴다.
 *        룰 모드는 확정법(confirmed) 고정 — 개편안(미확정)은 이 계산기의 제외 범위다.
 */

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateTransferTax } from '@/lib/tax/transfer'
import { buildRegionCode, isKnownRegion } from '@/lib/tax/regions'
import type { TransferHouseCount, TransferInput, TransferResult } from '@/lib/tax/transfer-types'

/** 계산기 화면이 보내는 요청 — 소재지는 이름으로 받아 서버가 검증·조립한다 */
export interface TransferCalcPayload {
  transferDate: string            // 양도일 (YYYY-MM-DD)
  acquiredAt: string              // 취득일 (YYYY-MM-DD)
  sido: string
  sigungu: string
  transferPrice: number           // 양도가액 (원)
  acquirePrice: number            // 취득가액 (원)
  expenses?: number               // 필요경비 (원) — 비우면 0
  houseCount: TransferHouseCount  // 1 / 2 / 3(=3주택 이상)
  residenceYears?: number         // 거주기간 (만 연수)
  acquiredInRegulatedArea?: boolean   // '취득 당시' 조정대상지역 여부 — 사용자 직접 선택
  isTemporaryTwoHouse?: boolean
  newHouseAcquiredAt?: string
  inherited?: boolean
  inheritanceOpenedAt?: string
  decedentAcquiredAt?: string
  graceContractDate?: string      // 경과조치 — 매매계약 체결일
  graceDepositReceived?: boolean  // 경과조치 — 계약금 수령 여부
}

/**
 * @함수명: calculateTransfer
 * @설명: 양도소득세를 계산합니다. 룰이 없으면 0원 대신 실패 결과(한국어 안내)가 반환되고,
 *        그 경우 이력은 기록하지 않습니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 엔진 결과 (성공: 단계별 금액+근거 / 실패: 코드+안내문)
 */
export async function calculateTransfer(payload: TransferCalcPayload): Promise<TransferResult> {
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

  const input: TransferInput = {
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
  }

  const supabase = await createClient()
  const result = await calculateTransferTax(supabase, input, 'confirmed')

  if (result.ok) {
    // 계산 이력 기록 — 실패해도 계산 결과 반환은 막지 않는다 (다른 계산기와 같은 원칙)
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('tax_calculation_logs').insert({
        tax_type: 'transfer',
        base_date: input.baseDate,
        rule_mode: 'confirmed',
        input,
        output: {
          exempt: result.exempt,
          exemptReason: result.exemptReason,
          highPriceApplied: result.highPriceApplied,
          taxableRatio: result.taxableRatio,
          breakdown: result.breakdown,
          ltsdTable: result.ltsdTable,
          ltsdCapApplied: result.ltsdCapApplied,
          heavyApplied: result.heavyApplied,
          heavyExemptedByGrace: result.heavyExemptedByGrace,
          ratePathChosen: result.ratePathChosen,
          comparisonApplied: result.comparisonApplied,
          holdingYearsForRate: result.holdingYearsForRate,
          holdingYearsForLtsd: result.holdingYearsForLtsd,
          regulatedAtTransfer: result.regulatedAtTransfer,
          containsProposedRule: result.containsProposedRule,
          unresolvedFields: result.unresolvedFields,
        },
        applied_rule_ids: result.appliedRules.map((r) => r.id),
      })
      if (error) console.error('[tax] 양도소득세 이력 기록 실패:', error.message)
    } catch (err) {
      console.error('[tax] 양도소득세 이력 기록 실패:', err instanceof Error ? err.message : String(err))
    }
  }

  return result
}
