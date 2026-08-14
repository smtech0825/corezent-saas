/**
 * @파일: lib/tax/registration.ts
 * @설명: 등기비용 계산기(아파트 매매 소유권 이전) — 새로 계산하는 것이 거의 없고
 *        이미 검증된 엔진을 불러 모으는 구조다.
 *        등기비용 = 취득세(+지방교육세·농어촌특별세) + 인지세 + 등기신청 수수료
 *                 + 국민주택채권 즉시매도 손실액 + 법무사 보수.
 *        ⚠️ 취득세·인지세는 기존 엔진(calculateAcquisitionTax·calculateStampTax)을
 *        호출한다 — 재구현 금지(같은 계산이 두 곳에 있으면 한쪽만 고쳐져 어긋난다).
 *        호출한 엔진이 실패하면 조용히 0으로 넘기지 않고 전체를 중단한다
 *        (종부세가 재산세 룰 실패를 다루는 방식과 같다).
 *        채권 손실률(매일 변동)·법무사 보수(자율 협의)는 사용자 입력이며, 비우면
 *        0이 아니라 '포함하지 않음'으로 담는다 — 총액이 실제보다 작을 수 있음을
 *        결과가 스스로 말하게 한다. 수수료·매입률 숫자는 전부 룰에서 온다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json, TaxRuleMode } from './types'
import type { AppliedRuleInfo, TaxEngineFailure } from './engine-types'
import type {
  RegistrationBondDetail,
  RegistrationInput,
  RegistrationItemStatus,
  RegistrationResult,
} from './registration-types'
import { engineFail, fetchValidRules, isValidDateString, isValidRegionCode, requireRule, COMMON_RULE_KEYS } from './rule-store'
import { applyRounding, parseMetroScope, selectRateRow } from './rule-value'
import { calculateAcquisitionTax } from './acquisition'
import { calculateStampTax } from './stamp'
import { REGISTRATION_RULE_KEYS, parseRegistrationBond, parseRegistrationFee } from './registration-rules'

/** 입력 검증 — 실패하면 한국어 안내가 담긴 실패 결과, 통과하면 null */
function validateInput(input: RegistrationInput): TaxEngineFailure | null {
  if (!isValidDateString(input.baseDate)) {
    return engineFail('INVALID_INPUT', '취득일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  }
  if (!isValidRegionCode(input.regionCode)) {
    return engineFail('INVALID_INPUT', '소재지 지역 코드가 올바르지 않습니다.')
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return engineFail('INVALID_INPUT', '취득가액은 0보다 큰 숫자여야 합니다.')
  }
  // 시가표준액은 채권 매입액의 기준이라 이 계산기에서는 필수다(취득세 단독 계산과 다름)
  if (!Number.isFinite(input.officialPrice) || input.officialPrice <= 0) {
    return engineFail('INVALID_INPUT', '시가표준액(공시가격)은 0보다 큰 숫자여야 합니다. 국민주택채권 매입액 계산의 기준입니다.')
  }
  if (!Number.isInteger(input.houseCountAfter) || input.houseCountAfter < 1) {
    return engineFail('INVALID_INPUT', '취득 후 주택 수는 1 이상의 정수여야 합니다.')
  }
  if (input.areaSqm !== undefined && (!Number.isFinite(input.areaSqm) || input.areaSqm <= 0)) {
    return engineFail('INVALID_INPUT', '전용면적은 0보다 큰 숫자(㎡)여야 합니다.')
  }
  // 손실률 0%는 '손실 없음'이라는 정상 값이므로 허용한다(세액을 0으로 만드는 함정이 아니다)
  if (input.bondLossPercent !== undefined &&
    (!Number.isFinite(input.bondLossPercent) || input.bondLossPercent < 0 || input.bondLossPercent > 100)) {
    return engineFail('INVALID_INPUT', '채권 즉시매도 손실률은 0 이상 100 이하 숫자(%)여야 합니다.')
  }
  if (input.judicialFee !== undefined && (!Number.isFinite(input.judicialFee) || input.judicialFee < 0)) {
    return engineFail('INVALID_INPUT', '법무사 보수는 0 이상의 숫자(원)여야 합니다.')
  }
  return null
}

/**
 * @함수명: calculateRegistrationCost
 * @설명: 등기비용을 계산합니다. 취득세·인지세는 기존 엔진을 호출해 구하고(실패 시 전체
 *        중단), 등기신청 수수료·채권 매입률은 registration 룰에서 읽습니다.
 *        선택 항목(채권 손실·법무사 보수)이 비어 있으면 총액에서 빼는 대신
 *        '포함하지 않음'으로 담아 화면이 그 사실을 표시할 수 있게 합니다.
 * @매개변수: supabase - Supabase 클라이언트(서버) / input - 계산 입력 / mode - 룰 모드
 * @반환값: 성공(항목별 금액 + 포함 여부 + 근거) 또는 실패(한국어 안내)
 */
export async function calculateRegistrationCost(
  supabase: SupabaseClient,
  input: RegistrationInput,
  mode: TaxRuleMode,
): Promise<RegistrationResult> {
  const inputError = validateInput(input)
  if (inputError) return inputError

  // ── 등기 룰 세트 로드 (공통 룰 포함 — is_metro 판정용) ──────────────────────
  const fetched = await fetchValidRules(supabase, 'registration', input.baseDate, mode)
  if (!fetched.ok) return fetched
  const rules = fetched.rules

  const applied = new Map<string, AppliedRuleInfo>()
  const unresolvedFields = new Set<string>()

  // ── 취득세 — 기존 엔진 호출 (매매 고정 — 상속·증여 등기는 범위 밖) ──────────
  const acqRes = await calculateAcquisitionTax(
    supabase,
    {
      baseDate: input.baseDate,
      regionCode: input.regionCode,
      sido: input.sido,
      cause: 'sale',
      price: input.price,
      houseCountAfter: input.houseCountAfter,
      areaSqm: input.areaSqm,
      firstHome: input.firstHome,
      temporaryTwoHome: input.temporaryTwoHome,
      officialPrice: input.officialPrice,
    },
    mode,
  )
  if (!acqRes.ok) {
    return engineFail(
      acqRes.code,
      `취득세를 계산할 수 없어 등기비용 계산을 중단했습니다(0원으로 대체하지 않습니다). ${acqRes.message}`,
      acqRes.ruleKey,
    )
  }
  for (const r of acqRes.appliedRules) applied.set(r.id, r)
  acqRes.unresolvedFields.forEach((f) => unresolvedFields.add(f))

  // ── 인지세 — 기존 엔진 호출 (계약금액 = 취득가액, 주택 고정) ────────────────
  const stampRes = await calculateStampTax(
    supabase,
    { baseDate: input.baseDate, contractPrice: input.price, isHousing: true },
    mode,
  )
  if (!stampRes.ok) {
    return engineFail(
      stampRes.code,
      `인지세를 계산할 수 없어 등기비용 계산을 중단했습니다(0원으로 대체하지 않습니다). ${stampRes.message}`,
      stampRes.ruleKey,
    )
  }
  for (const r of stampRes.appliedRules) applied.set(r.id, r)

  // ── 등기신청 수수료 — 룰의 기본(default) 행을 쓰고 나머지는 참고로 담는다 ────
  const feeRule = requireRule(rules, REGISTRATION_RULE_KEYS.fee, input.baseDate)
  if (!feeRule.ok) return feeRule
  const fee = parseRegistrationFee(feeRule.rule.rule_value, feeRule.rule.rule_key)
  if (!fee.ok) return fee
  applied.set(feeRule.rule.id, toAppliedInfo(feeRule.rule))
  const defaultRow = fee.value.rows.find((r) => r.default === true)
  if (!defaultRow) {
    // 검증기가 default 1개를 보장하지만, 저장 경로 밖에서 들어온 값에 대한 이중 방어
    return engineFail('RULE_VALUE_INVALID',
      `룰('${feeRule.rule.rule_key}')에 기본 적용 행("default": true)이 없습니다. 관리자 화면에서 룰 값을 수정해 주세요.`,
      feeRule.rule.rule_key)
  }
  const feeOtherMethods = fee.value.rows
    .filter((r) => r !== defaultRow)
    .map((r) => ({ methodLabel: r.methodLabel, amount: r.amount }))

  // ── 국민주택채권 — 매입 의무액(룰) → 즉시매도 손실액(사용자 손실률) ─────────
  const bondRule = requireRule(rules, REGISTRATION_RULE_KEYS.bond, input.baseDate)
  if (!bondRule.ok) return bondRule
  const bondValue = parseRegistrationBond(bondRule.rule.rule_value, bondRule.rule.rule_key)
  if (!bondValue.ok) return bondValue

  // 수도권 여부 — 공통 룰(region.metro_scope)이 있으면 판정, 없으면 미확정(취득세와 동일 관례)
  let isMetro: boolean | undefined
  const metroRule = rules.get(COMMON_RULE_KEYS.metroScope)
  if (metroRule) {
    const scope = parseMetroScope(metroRule.rule_value, metroRule.rule_key)
    if (!scope.ok) return scope
    if (input.sido && input.sido.trim() !== '') isMetro = scope.value.sidoNames.includes(input.sido)
  }

  // 판정 컨텍스트 — 채권 매입률 행(when)이 쓸 수 있는 필드
  const context: Record<string, Json | undefined> = {
    official_price: input.officialPrice,   // 시가표준액 (원)
    price: input.price,                    // 취득가액 (원)
    sido: input.sido,                      // 시·도 이름 — 지역별 매입률 조건
    is_metro: isMetro,                     // 수도권 여부 — metro_scope 룰 필요
  }
  const bondPicked = selectRateRow(bondValue.value.rows, context, bondRule.rule.rule_key)
  if (!bondPicked.ok) return bondPicked
  bondPicked.unresolved.forEach((f) => unresolvedFields.add(f))
  applied.set(bondRule.rule.id, toAppliedInfo(bondRule.rule))
  const bondPurchase = applyRounding(
    (input.officialPrice * bondPicked.row.ratePercent) / 100,
    bondValue.value.rounding ?? null,
  )

  let bond: RegistrationBondDetail
  let bondLoss: RegistrationItemStatus
  if (input.bondLossPercent === undefined) {
    const reason =
      '채권 즉시매도 손실률을 입력하지 않아 채권 손실액을 포함하지 않았습니다. 손실률은 매일 바뀌는 값이라 이 계산기가 정할 수 없습니다 — 입력하면 포함됩니다.'
    bond = { status: 'not_included', reason }
    bondLoss = { status: 'not_included', reason }
  } else {
    const lossAmount = Math.floor((bondPurchase * input.bondLossPercent) / 100)
    bond = {
      status: 'included',
      purchaseAmount: bondPurchase,
      ratePercent: bondPicked.row.ratePercent,
      lossPercent: input.bondLossPercent,
      lossAmount,
    }
    bondLoss = { status: 'included', amount: lossAmount }
  }

  // ── 법무사 보수 — 자율 협의라 룰이 없다. 입력 없으면 '포함하지 않음' ────────
  const judicialFee: RegistrationItemStatus =
    input.judicialFee === undefined
      ? {
          status: 'not_included',
          reason: '법무사 보수를 입력하지 않아 포함하지 않았습니다. 보수는 자율 협의라 정해진 값이 없습니다 — 입력하면 포함됩니다.',
        }
      : { status: 'included', amount: input.judicialFee }

  // ── 총액 — 포함된 항목만 합산 ───────────────────────────────────────────────
  const total =
    acqRes.breakdown.acquisitionTax +
    acqRes.breakdown.localEducationTax +
    acqRes.breakdown.ruralSpecialTax +
    stampRes.amount +
    defaultRow.amount +
    (bondLoss.status === 'included' ? bondLoss.amount : 0) +
    (judicialFee.status === 'included' ? judicialFee.amount : 0)

  const appliedRules = Array.from(applied.values())
  return {
    ok: true,
    breakdown: {
      acquisitionTax: acqRes.breakdown.acquisitionTax,
      localEducationTax: acqRes.breakdown.localEducationTax,
      ruralSpecialTax: acqRes.breakdown.ruralSpecialTax,
      stampTax: stampRes.amount,
      registrationFee: defaultRow.amount,
      bondLoss,
      judicialFee,
      total,
    },
    someExcluded: bondLoss.status === 'not_included' || judicialFee.status === 'not_included',
    feeMethodLabel: defaultRow.methodLabel,
    feeOtherMethods,
    bond,
    stampExempt: stampRes.exempt,
    stampExemptReason: stampRes.exemptReason,
    isRegulatedArea: acqRes.isRegulatedArea,
    appliedRules,
    ruleMode: mode,
    containsProposedRule: appliedRules.some((r) => r.status === 'proposed'),
    unresolvedFields: Array.from(unresolvedFields),
  }
}

/** 룰 행을 결과 화면용 근거 정보로 변환 (다른 세목과 동일 형식) */
function toAppliedInfo(rule: {
  id: string; rule_key: string; law_name: string; law_article: string; law_url: string
  effective_from: string; effective_to: string | null; status: AppliedRuleInfo['status']
}): AppliedRuleInfo {
  return {
    id: rule.id,
    ruleKey: rule.rule_key,
    lawName: rule.law_name,
    lawArticle: rule.law_article,
    lawUrl: rule.law_url,
    effectiveFrom: rule.effective_from,
    effectiveTo: rule.effective_to,
    status: rule.status,
  }
}
