'use server'

/**
 * @파일: tax/transfer/actions.ts
 * @설명: 양도소득세 계산 서버 액션 — BotID 검증(공개 POST 남용 방지) → 소재지 목록 검증 →
 *        엔진 호출, 성공 시 tax_calculation_logs에 계산 이력을 기록한다.
 *        ⚠️ 개인식별정보(IP·이메일·이름)는 어떤 필드에도 기록하지 않는다.
 *        룰 조회는 공개 읽기(anon) 클라이언트, 이력 기록만 service_role 클라이언트를 쓴다.
 *        룰 모드는 화면이 선택한다(기본 확정법) — 개정안(proposed) 모드는 국회 통과 전
 *        개편안 룰을 포함해 계산하며, 결과에 경고가 함께 표시된다(취득세와 같은 구조).
 *        연도별 비교(includeYearComparison)는 본 계산 성공 시에만 부속으로 붙으며,
 *        비교 연도는 등록된 개정안 룰의 시행일에서 나온다(lib/tax/year-comparison.ts).
 */

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateTransferTax } from '@/lib/tax/transfer'
import { buildRegionCode, isKnownRegion } from '@/lib/tax/regions'
import { engineFail, isValidDateString } from '@/lib/tax/rule-store'
import { replaceDateYear, runYearComparison } from '@/lib/tax/year-comparison'
import type { YearComparison } from '@/lib/tax/year-comparison'
import type { TaxRuleMode } from '@/lib/tax/types'
import type {
  TransferHouseCount,
  TransferInput,
  TransferResult,
  TransferSuccess,
} from '@/lib/tax/transfer-types'

/** 계산기 화면이 보내는 요청 — 소재지는 이름으로 받아 서버가 검증·조립한다 */
export interface TransferCalcPayload {
  /** 확정법(confirmed) / 개정안 포함(proposed). 비우면 확정법 — 이 페이로드를 재사용하는
   *  실수령액 계산기(모드 전환 미제공, 확정법 고정)가 보내지 않기 때문이다 */
  ruleMode?: TaxRuleMode
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
  /** 연도별 비교 요청 — 선택 필드로만 유지한다(실수령액 계산기가 이 페이로드를 확장하며,
   *  보내지 않으면 비교 없이 기존과 동일하게 동작해야 한다) */
  includeYearComparison?: boolean
}

/** 액션 응답 — 본 계산 결과 + (요청 시) 연도별 비교. 비교 실패는 본 결과 반환을 막지 않는다 */
export interface TransferCalcResponse {
  result: TransferResult
  /** includeYearComparison 요청·본 계산 성공·비교 성립(성공 1건 이상)일 때만 담긴다 */
  comparison?: YearComparison<TransferSuccess>
}

/**
 * @함수명: calculateTransfer
 * @설명: 양도소득세를 계산합니다. 룰이 없으면 0원 대신 실패 결과(한국어 안내)가 반환되고,
 *        그 경우 이력은 기록하지 않습니다. includeYearComparison 요청 시 본 계산이
 *        성공하면 연도별 비교(양도일 연도만 치환한 반복 계산)를 곁들여 반환합니다.
 * @매개변수: payload - 계산기 화면 입력
 * @반환값: 본 계산 결과(성공: 단계별 금액+근거 / 실패: 코드+안내문) + 선택적 연도별 비교
 */
export async function calculateTransfer(payload: TransferCalcPayload): Promise<TransferCalcResponse> {
  // BotID 검증 — 다른 계산기 액션과 같은 관례(검증 자체 실패는 잡아서 통과 — 보호는 최선 노력)
  try {
    const botCheck = await checkBotId()
    if (botCheck.isBot) {
      return { result: { ok: false, code: 'INVALID_INPUT', message: '접근이 거부되었습니다. 잠시 후 다시 시도해 주세요.' } }
    }
  } catch (err) {
    console.error('[tax] BotID 검증 실패(통과 처리):', err instanceof Error ? err.message : String(err))
  }

  // 소재지는 행정구역 목록에 있는 조합만 허용 — 임의 문자열 차단
  if (!isKnownRegion(payload.sido, payload.sigungu)) {
    return { result: { ok: false, code: 'INVALID_INPUT', message: '소재지는 목록에서 선택해 주세요.' } }
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

  // 알 수 없는 값은 확정법으로 강등 — 임의 문자열로 proposed가 열리는 것을 막는다(취득세와 동일)
  const ruleMode: TaxRuleMode = payload.ruleMode === 'proposed' ? 'proposed' : 'confirmed'
  const supabase = await createClient()
  const result = await calculateTransferTax(supabase, input, ruleMode)

  if (result.ok) {
    // 계산 이력 기록 — 실패해도 계산 결과 반환은 막지 않는다 (다른 계산기와 같은 원칙)
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('tax_calculation_logs').insert({
        tax_type: 'transfer',
        base_date: input.baseDate,
        rule_mode: ruleMode,
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
          filingRelief: result.filingRelief,
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

  // 연도별 비교 — 요청 시·본 계산 성공 시에만 곁들인다. 비교할 연도는 등록된 개정안 룰의
  // 시행일에서 나오고(코드에 연도 없음), 기준 연도(올해 KST)=확정법·이후 해=개정안 모드로
  // 양도일의 연도만 치환해 계산한다. 부속 호출이라 이력은 남기지 않으며(위 기록은 본 계산
  // 1건뿐), 비교가 실패해도 본 결과 반환은 막지 않는다.
  let comparison: YearComparison<TransferSuccess> | undefined
  if (payload.includeYearComparison === true && result.ok) {
    try {
      const inputYear = Number(input.baseDate.slice(0, 4))
      comparison =
        (await runYearComparison<TransferSuccess>(supabase, 'transfer', inputYear, ruleMode, (year, mode) => {
          // 연도만 치환하면 계산할 수 없는 양도일이 될 수 있다 — 사용자 입력은 정상이므로
          // 엔진의 입력 오류 문구 대신 비교 전용 안내로 그 해만 접는다
          const baseDate = replaceDateYear(input.baseDate, year)
          if (!isValidDateString(baseDate)) {
            return Promise.resolve(
              engineFail('INVALID_INPUT', '이 해에는 입력하신 월·일이 없어(윤년 날짜) 비교하지 못했습니다.'),
            )
          }
          if (baseDate < input.acquiredAt) {
            return Promise.resolve(
              engineFail('INVALID_INPUT', '취득일보다 앞선 해라 비교하지 않습니다.'),
            )
          }
          return calculateTransferTax(supabase, { ...input, baseDate }, mode)
        })) ?? undefined
    } catch (err) {
      console.error('[tax] 양도소득세 연도별 비교 실패(본 결과만 반환):', err instanceof Error ? err.message : String(err))
    }
  }

  return { result, comparison }
}
