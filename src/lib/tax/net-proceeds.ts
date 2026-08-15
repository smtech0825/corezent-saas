/**
 * @파일: lib/tax/net-proceeds.ts
 * @설명: 매도 실수령액 계산기 — 새로 계산하는 것이 없고 기존 엔진을 불러 모은다.
 *        실수령액 = 양도가액 − 양도소득세 − 지방소득세 − 중개수수료 − 그 밖의 비용.
 *        ⚠️ 양도소득세·중개수수료는 기존 엔진(calculateTransferTax·calculateBrokerageCap)을
 *        호출한다 — 재구현 금지. 어느 엔진이든 실패하면 조용히 0으로 넘기지 않고
 *        전체를 중단하며 원인 코드·룰 키를 보존한다(등기비용·종부세와 같은 방식).
 *        양도소득세가 비과세로 0원이면 그것도 정상 결과다 — 사유를 그대로 전달한다.
 *        중개수수료는 법정 상한액이므로 실제 지급액 입력이 없으면 상한액+부가세를 쓰고
 *        그 사실(isCap)을 결과에 담는다. 요율·부가세율 숫자는 전부 룰에서 온다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaxRuleMode } from './types'
import type { AppliedRuleInfo, TaxEngineFailure } from './engine-types'
import type { NetProceedsInput, NetProceedsResult } from './net-proceeds-types'
import { engineFail } from './rule-store'
import { calculateTransferTax } from './transfer'
import { calculateBrokerageCap } from './brokerage'

/** 입력 검증 — 이 계산기 고유 항목만. 양도세 항목은 양도세 엔진이 그대로 검증한다 */
function validateInput(input: NetProceedsInput): TaxEngineFailure | null {
  // 실제 수수료 0원은 '직거래·무료'라는 정상 값이므로 허용한다(총액을 0으로 만드는 함정이 아니다)
  if (input.actualBrokerageFee !== undefined &&
    (!Number.isFinite(input.actualBrokerageFee) || input.actualBrokerageFee < 0)) {
    return engineFail('INVALID_INPUT', '실제 중개수수료는 0 이상의 숫자(원)여야 합니다.')
  }
  if (input.otherCosts !== undefined && (!Number.isFinite(input.otherCosts) || input.otherCosts < 0)) {
    return engineFail('INVALID_INPUT', '그 밖의 비용은 0 이상의 숫자(원)여야 합니다.')
  }
  return null
}

/**
 * @함수명: calculateNetProceeds
 * @설명: 매도 실수령액을 계산합니다. 양도소득세(비과세 포함)·중개수수료를 기존 엔진으로
 *        구해 양도가액에서 차감합니다. 결과에는 차감 항목별 금액과 함께 중개수수료가
 *        상한액인지 실제 입력액인지, 양도세 상세(비과세 사유 포함)를 전부 담습니다.
 * @매개변수: supabase - Supabase 클라이언트(서버) / input - 계산 입력 / mode - 룰 모드
 * @반환값: 성공(실수령액 + 차감 분해 + 근거) 또는 실패(한국어 안내)
 */
export async function calculateNetProceeds(
  supabase: SupabaseClient,
  input: NetProceedsInput,
  mode: TaxRuleMode,
): Promise<NetProceedsResult> {
  const inputError = validateInput(input)
  if (inputError) return inputError

  // 중개수수료 요율 조건(시·도)에 필요 — 양도세 단독 계산과 달리 여기서는 필수.
  // 함수 밖 검증은 타입을 좁히지 못해 본문에서 검사한다.
  const sido = input.sido
  if (!sido || sido.trim() === '') {
    return engineFail('INVALID_INPUT', '소재지 시·도는 중개수수료 계산에 필요합니다. 목록에서 선택해 주세요.')
  }

  const applied = new Map<string, AppliedRuleInfo>()

  // ── 양도소득세 — 기존 엔진 호출. 비과세(exempt)는 실패가 아니라 정상 결과다 ──
  const transferRes = await calculateTransferTax(supabase, input, mode)
  if (!transferRes.ok) {
    return {
      ...engineFail(
        transferRes.code,
        `양도소득세를 계산할 수 없어 실수령액 계산을 중단했습니다(0원으로 대체하지 않습니다). ${transferRes.message}`,
        transferRes.ruleKey,
      ),
      // 취득 당시 조정대상지역을 자동 판정하지 못한 사유는 그대로 옮긴다 — 감싸면서 잃으면
      // 이 화면만 '왜 직접 선택해야 하는지'를 설명하지 못한다
      ...(transferRes.acquiredRegulatedUnavailable
        ? { acquiredRegulatedUnavailable: transferRes.acquiredRegulatedUnavailable }
        : {}),
    }
  }
  for (const r of transferRes.appliedRules) applied.set(r.id, r)

  // ── 중개수수료 — 기존 엔진으로 법정 상한액 계산 ────────────────────────────
  // 중개보수 요율은 본래 중개사무소 소재지 조례 기준이지만 물건 소재지로 갈음한다
  // (승인된 설계 — 화면이 판단 한계로 안내).
  const brokerageRes = await calculateBrokerageCap(
    supabase,
    { baseDate: input.baseDate, dealType: 'sale_exchange', sido, price: input.transferPrice },
    mode,
  )
  if (!brokerageRes.ok) {
    return engineFail(
      brokerageRes.code,
      `중개수수료를 계산할 수 없어 실수령액 계산을 중단했습니다(0원으로 대체하지 않습니다). ${brokerageRes.message}`,
      brokerageRes.ruleKey,
    )
  }
  for (const r of brokerageRes.appliedRules) applied.set(r.id, r)

  // 실제 지급액이 있으면 그대로(부가세 포함 입력 전제), 없으면 상한액+부가세를 쓴다
  const isCap = input.actualBrokerageFee === undefined
  const capWithVat = brokerageRes.capAmount + brokerageRes.vatAmount
  const brokerageDeducted = isCap ? capWithVat : (input.actualBrokerageFee as number)
  const actualExceedsCap = !isCap && (input.actualBrokerageFee as number) > capWithVat

  // ── 실수령액 — 양도가액에서 차감 항목을 뺀다 ────────────────────────────────
  const otherCosts = input.otherCosts ?? 0
  const totalTax = transferRes.breakdown.totalTax   // 양도소득세 + 지방소득세 (비과세면 0)
  const netProceeds = input.transferPrice - totalTax - brokerageDeducted - otherCosts

  const appliedRules = Array.from(applied.values())
  return {
    ok: true,
    breakdown: {
      transferPrice: input.transferPrice,
      transferTax: transferRes.breakdown.transferTax,
      localIncomeTax: transferRes.breakdown.localIncomeTax,
      brokerageDeducted,
      otherCosts,
      netProceeds,
    },
    brokerage: {
      isCap,
      capAmount: brokerageRes.capAmount,
      vatAmount: brokerageRes.vatAmount,
      appliedRatePercent: brokerageRes.appliedRatePercent,
      actualExceedsCap,
    },
    transfer: transferRes,
    appliedRules,
    ruleMode: mode,
    containsProposedRule: appliedRules.some((r) => r.status === 'proposed'),
    unresolvedFields: transferRes.unresolvedFields,
  }
}
