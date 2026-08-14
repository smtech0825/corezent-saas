/**
 * @파일: lib/tax/net-proceeds-types.ts
 * @설명: 매도 실수령액 엔진의 입력·결과 타입.
 *        실수령액 = 양도가액 − 양도소득세 − 지방소득세 − 중개수수료 − 그 밖의 비용.
 *        ⚠️ 새 룰이 없다 — 양도소득세·중개수수료 룰을 기존 엔진 호출로 그대로 쓴다.
 *        rule_value 스키마 타입도 없다(등록할 룰이 없으므로).
 *        중개수수료는 법정 '상한액'이라 실제 지급액을 사용자가 입력할 수 있고,
 *        비우면 상한액(+부가세)을 쓰되 그 사실을 결과에 담는다.
 */

import type { TransferInput, TransferSuccess } from './transfer-types'
import type { AppliedRuleInfo, TaxEngineFailure } from './engine-types'
import type { TaxRuleMode } from './types'

/**
 * @타입: NetProceedsInput
 * @설명: 매도 실수령액 계산 입력 — 양도소득세 계산기와 같은 항목(TransferInput 그대로)에
 *        중개수수료 실제 지급액(선택)과 그 밖의 비용(선택)을 더한 것.
 *        sido는 중개수수료 요율 조건에 필요해 이 계산기에서는 필수다(엔진이 검증).
 *        중개보수 요율은 본래 중개사무소 소재지 조례를 따르지만 이 계산기는 물건
 *        소재지로 갈음한다(입력을 늘리지 않는 대원칙 — 화면이 한계를 안내).
 */
export interface NetProceedsInput extends TransferInput {
  /** 실제 지급한(하기로 한) 중개수수료(원, 부가세 포함) — 비우면 법정 상한액+부가세 사용 */
  actualBrokerageFee?: number
  /** 그 밖의 비용(원) — 수리비·이사비 등. 비우면 0(없는 것으로 본다) */
  otherCosts?: number
}

/** 중개수수료 차감 상세 — 상한액을 썼는지, 실제 입력액이 상한을 넘는지 */
export interface NetProceedsBrokerageDetail {
  /** true면 실제 지급액 미입력이라 법정 상한액(협의 전 최대치)을 썼다 — 화면이 명시 */
  isCap: boolean
  capAmount: number           // 법정 상한액(원, 부가세 별도) — 중개수수료 엔진 결과
  vatAmount: number           // 상한액 기준 부가가치세(원) — isCap일 때 차감에 포함
  appliedRatePercent: number  // 적용된 상한 요율(%) — 룰 값
  /** 실제 입력액이 상한액+부가세를 넘는지 — 법정 상한 초과 지급 경고용 */
  actualExceedsCap: boolean
}

/** 차감 항목별 금액 — 양도가액에서 무엇이 얼마씩 빠지는지 */
export interface NetProceedsBreakdown {
  transferPrice: number       // 양도가액 (원)
  transferTax: number         // 양도소득세 (비과세면 0 — 정상 결과)
  localIncomeTax: number      // 지방소득세
  brokerageDeducted: number   // 차감된 중개수수료 (상한액+부가세 또는 실제 입력액)
  otherCosts: number          // 그 밖의 비용 (미입력이면 0)
  netProceeds: number         // 실수령액
}

/**
 * @타입: NetProceedsSuccess
 * @설명: 매도 실수령액 계산 성공 결과. 사람들이 실제로 궁금한 숫자는 실수령액이므로
 *        그것이 중심이고, 양도세 상세(비과세 사유·판정 전부)는 transfer에 그대로 담아
 *        화면이 필요한 만큼 보여줄 수 있게 한다.
 */
export interface NetProceedsSuccess {
  ok: true
  breakdown: NetProceedsBreakdown
  brokerage: NetProceedsBrokerageDetail
  /** 양도소득세 엔진의 성공 결과 전체 — 비과세 여부·사유·판정 내역 포함 */
  transfer: TransferSuccess
  appliedRules: AppliedRuleInfo[]   // 양도세·중개수수료 룰 병합 (세목은 룰 키 접두사로 구분)
  ruleMode: TaxRuleMode
  containsProposedRule: boolean
  unresolvedFields: string[]
}

export type NetProceedsResult = NetProceedsSuccess | TaxEngineFailure
