/**
 * @파일: lib/tax/transfer.ts
 * @설명: 양도소득세 계산기(아파트 양도) — 이 서비스에서 가장 중요한 계산기.
 *        엔진은 세율·공제율·구간·기준액·연수 요건·날짜를 모른다: 전부 DB 룰(transfer.*)에서
 *        읽고, 코드는 계산 순서(비과세 → 고가 안분 → 양도차익 → 중과 → 장기보유특별공제 →
 *        기본공제 → 세율(비교과세) → 지방소득세 → 단수 처리)만 안다.
 *        ⚠️ 반드시 구분할 것(설계서 4대 구분):
 *        ① 보유기간 2종 — 세율용(§104②, 상속은 피상속인 취득일 기산)과 장기보유특별공제용
 *           (§95④, 상속은 상속개시일 기산)을 별도 함수·별도 기산일로 계산한다.
 *        ② 장기보유특별공제 표 2개 — 큰 표(1세대 1주택+거주 요건)·작은 표. 중과면 공제 없음.
 *        ③ 거주 요건 2종 — 비과세용(취득 당시 조정대상지역인 경우만)과 큰 표용(항상 적용).
 *        ④ 조정대상지역 판정 시점 2개 — 비과세=취득 당시(사용자 직접 선택),
 *           중과=양도 당시(tax_regulated_areas 이력 자동 판정).
 *        중과 유예 기간은 transfer.heavy 룰의 시행기간 이력로 표현한다(날짜를 코드에 안 둔다).
 *        룰이 없으면 0원으로 계산하지 않고 RULE_NOT_REGISTERED를 반환한다.
 *        ⚠️ ltsd.general·basic_deduction은 구 형식(확정법)과 신 형식(2026 세제개편안)을 모두
 *        지원한다 — 계산 방식은 모드가 아니라 '집힌 룰의 값 형식'이 정하며, 확정법 룰은
 *        재등록 없이 구 형식 그대로 동작한다. ltsd.cap(물건별 한도)은 개정안 전용 선택 룰로,
 *        기준일에 유효한 룰이 없으면 한도를 적용하지 않는다(형식 정의는 transfer-types.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json, TaxRule, TaxRuleMode } from './types'
import type { AppliedRuleInfo, RateSpec, TaxEngineFailure } from './engine-types'
import type {
  TransferBreakdown,
  TransferInput,
  TransferLtsdTable,
  TransferRatePath,
  TransferResult,
  TransferSuccess,
} from './transfer-types'
import { COMMON_RULE_KEYS, engineFail, fetchValidRules, isRegulatedArea, isValidDateString, isValidRegionCode, requireRule } from './rule-store'
import { applyRounding, evaluateRateSpec, parseMetroScope, parseRounding, selectRateRow, selectRateRowOptional } from './rule-value'
import type { RoundingValue } from './engine-types'
import { fullYearsBetween, holdingYearsForLtsd, holdingYearsForRate, isOnOrBeforeAnniversary, isOnOrBeforeMonthsAfter } from './period'
import {
  TRANSFER_RULE_KEYS,
  parseTransferBaseRates,
  parseTransferBasicDeduction,
  parseTransferExemption,
  parseTransferHeavy,
  parseTransferLocalIncomeTax,
  parseTransferLtsdCap,
  parseTransferLtsdGeneral,
  parseTransferLtsdOneHouse,
  parseTransferPeriodRule,
  parseTransferShortTerm,
  parseTransferTemporaryTwoHouse,
} from './transfer-rules'

/** 룰 행을 결과 화면용 근거 정보로 변환 (다른 세목과 동일 형식) */
function toAppliedInfo(rule: TaxRule): AppliedRuleInfo {
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

/** 입력 검증 — 실패하면 한국어 안내가 담긴 실패 결과, 통과하면 null */
function validateInput(input: TransferInput): TaxEngineFailure | null {
  if (!isValidDateString(input.baseDate)) return engineFail('INVALID_INPUT', '양도일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  if (!isValidDateString(input.acquiredAt)) return engineFail('INVALID_INPUT', '취득일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  if (input.acquiredAt > input.baseDate) return engineFail('INVALID_INPUT', '취득일이 양도일보다 늦을 수 없습니다.')
  if (!isValidRegionCode(input.regionCode)) return engineFail('INVALID_INPUT', '소재지 지역 코드가 올바르지 않습니다.')
  if (!Number.isFinite(input.transferPrice) || input.transferPrice <= 0) {
    return engineFail('INVALID_INPUT', '양도가액은 0보다 큰 숫자여야 합니다.')
  }
  if (!Number.isFinite(input.acquirePrice) || input.acquirePrice < 0) {
    return engineFail('INVALID_INPUT', '취득가액은 0 이상의 숫자여야 합니다.')
  }
  if (input.expenses !== undefined && (!Number.isFinite(input.expenses) || input.expenses < 0)) {
    return engineFail('INVALID_INPUT', '필요경비는 0 이상의 숫자여야 합니다.')
  }
  if (input.houseCount !== 1 && input.houseCount !== 2 && input.houseCount !== 3) {
    return engineFail('INVALID_INPUT', '보유 주택 수가 올바르지 않습니다.')
  }
  if (input.residenceYears !== undefined && (!Number.isFinite(input.residenceYears) || input.residenceYears < 0)) {
    return engineFail('INVALID_INPUT', '거주기간은 0 이상의 숫자(만 연수)여야 합니다.')
  }
  // 미래 날짜 차단 — 양도일보다 뒤인 날짜가 통과하면 일시적 2주택·경과조치가 부당하게
  // 인정되거나(세액 과소) 보유 연수가 0으로 튄다(단기 경로). 전부 양도일 이하만 허용.
  if (input.inherited === true) {
    if (!input.inheritanceOpenedAt || !isValidDateString(input.inheritanceOpenedAt)) {
      return engineFail('INVALID_INPUT', '상속 주택은 상속개시일 입력이 필요합니다. (YYYY-MM-DD)')
    }
    if (input.inheritanceOpenedAt > input.baseDate) {
      return engineFail('INVALID_INPUT', '상속개시일이 양도일보다 늦을 수 없습니다.')
    }
    if (!input.decedentAcquiredAt || !isValidDateString(input.decedentAcquiredAt)) {
      return engineFail('INVALID_INPUT', '상속 주택은 피상속인 취득일 입력이 필요합니다. (YYYY-MM-DD)')
    }
    if (input.decedentAcquiredAt > input.baseDate) {
      return engineFail('INVALID_INPUT', '피상속인 취득일이 양도일보다 늦을 수 없습니다.')
    }
  }
  if (input.newHouseAcquiredAt !== undefined) {
    if (!isValidDateString(input.newHouseAcquiredAt)) {
      return engineFail('INVALID_INPUT', '신규주택 취득일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
    }
    if (input.newHouseAcquiredAt > input.baseDate) {
      return engineFail('INVALID_INPUT', '신규주택 취득일이 양도일보다 늦을 수 없습니다.')
    }
  }
  if (input.graceContractDate !== undefined) {
    if (!isValidDateString(input.graceContractDate)) {
      return engineFail('INVALID_INPUT', '매매계약 체결일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
    }
    if (input.graceContractDate > input.baseDate) {
      return engineFail('INVALID_INPUT', '매매계약 체결일이 양도일보다 늦을 수 없습니다.')
    }
  }
  return null
}

/**
 * 기본 세율 명세에 중과 가산 포인트(%p)를 더한 명세를 만든다 — 코드는 '가산'이라는
 * 구조만 알고 포인트 값은 룰에서 온다. fixed·progressive만 가산을 지원한다.
 */
function addPointsToRateSpec(spec: RateSpec, points: number): RateSpec | null {
  if (spec.type === 'fixed') return { type: 'fixed', ratePercent: spec.ratePercent + points }
  if (spec.type === 'progressive') {
    return {
      type: 'progressive',
      brackets: spec.brackets.map((b) => ({ ...b, ratePercent: b.ratePercent + points })),
    }
  }
  return null   // linear_by_base에는 가산 규칙이 정의되지 않음 — 호출부가 오류 처리
}

/**
 * @함수명: calculateTransferTax
 * @설명: 양도소득세를 계산합니다. 결과에는 세액뿐 아니라 어느 공제 표를 왜 썼는지,
 *        중과·경과조치·비교과세가 어떻게 적용됐는지, 판정하지 못한 조건이 무엇인지를
 *        전부 담습니다. 룰이 하나라도 없으면 0원 대신 실패(한국어 안내)를 반환합니다.
 * @매개변수: supabase - Supabase 클라이언트(서버) / input - 계산 입력 / mode - 룰 모드
 * @반환값: 성공(단계별 금액 + 근거) 또는 실패(한국어 안내)
 */
export async function calculateTransferTax(
  supabase: SupabaseClient,
  input: TransferInput,
  mode: TaxRuleMode,
): Promise<TransferResult> {
  const inputError = validateInput(input)
  if (inputError) return inputError

  const fetched = await fetchValidRules(supabase, 'transfer', input.baseDate, mode)
  if (!fetched.ok) return fetched
  const rules = fetched.rules

  const applied = new Map<string, AppliedRuleInfo>()
  const use = (rule: TaxRule) => applied.set(rule.id, toAppliedInfo(rule))
  const unresolvedFields = new Set<string>()

  // ── 연수 계산 방식(초일 산입) — 값은 룰에서, 코드에 기본값 없음 ─────────────
  const periodRule = requireRule(rules, TRANSFER_RULE_KEYS.periodRule, input.baseDate)
  if (!periodRule.ok) return periodRule
  const period = parseTransferPeriodRule(periodRule.rule.rule_value, periodRule.rule.rule_key)
  if (!period.ok) return period
  use(periodRule.rule)
  const incl = period.value.dayInclusion

  // ── 보유기간 2종 — 기산일이 다르다 (①) ─────────────────────────────────────
  // 세율용(§104② — 집행기준 104-0-11): 상속이면 '피상속인이 취득한 날'부터
  // 공제·비과세용(§95④ — 집행기준 95-0-1): 상속이면 '상속개시일'부터
  const rateStart = input.inherited === true ? (input.decedentAcquiredAt as string) : input.acquiredAt
  const ltsdStart = input.inherited === true ? (input.inheritanceOpenedAt as string) : input.acquiredAt
  const yearsForRate = holdingYearsForRate(rateStart, input.baseDate, incl)
  const yearsForLtsd = holdingYearsForLtsd(ltsdStart, input.baseDate, incl)
  // 거주기간은 보유기간(공제 기준) 안에 있어야 한다 — 거주 > 보유 입력은 판정을 왜곡하므로 차단
  if (input.residenceYears !== undefined && input.residenceYears > yearsForLtsd) {
    return engineFail('INVALID_INPUT', '거주기간이 보유기간보다 길 수 없습니다. 취득일·거주기간 입력을 확인해 주세요.')
  }
  // 비과세 보유 요건 판정용 — 이번 범위(상속주택 특례 제외)에서는 공제용과 같은 기산일이지만
  // 조문이 달라 변수로 분리해 둔다 (혼용 방지)
  const yearsForExemption = fullYearsBetween(ltsdStart, input.baseDate, incl)

  // ── '양도 당시' 조정대상지역 — 이력 자동 판정 (④의 중과 축) ─────────────────
  const reg = await isRegulatedArea(supabase, input.regionCode, input.baseDate, 'transfer', 'adjustment')
  if (!reg.ok) return reg
  const regulatedAtTransfer = reg.regulated

  // ── 수도권 여부(is_metro) — 경과조치의 지역 조건용 (공통 룰, 없으면 미확정) ──
  let isMetro: boolean | undefined
  const metroRule = rules.get(COMMON_RULE_KEYS.metroScope)
  if (metroRule) {
    const scope = parseMetroScope(metroRule.rule_value, metroRule.rule_key)
    if (!scope.ok) return scope
    if (input.sido && input.sido.trim() !== '') isMetro = scope.value.sidoNames.includes(input.sido)
  }

  // ── 1주택 계열 판정 — 일시적 2주택이면 1주택으로 간주 ──────────────────────
  let effectiveOneHouse = input.houseCount === 1
  let temporaryApplied = false
  if (input.houseCount === 2 && input.isTemporaryTwoHouse === true) {
    const tempRule = requireRule(rules, TRANSFER_RULE_KEYS.temporaryTwoHouse, input.baseDate)
    if (!tempRule.ok) return tempRule
    const temp = parseTransferTemporaryTwoHouse(tempRule.rule.rule_value, tempRule.rule.rule_key)
    if (!temp.ok) return temp
    if (!input.newHouseAcquiredAt) {
      return engineFail('INVALID_INPUT', '일시적 2주택 판정에는 신규주택 취득일 입력이 필요합니다.')
    }
    use(tempRule.rule)
    if (isOnOrBeforeAnniversary(input.newHouseAcquiredAt, input.baseDate, temp.value.maxYearsFromNewAcquisition)) {
      effectiveOneHouse = true
      temporaryApplied = true
    }
  }

  const expenses = input.expenses ?? 0

  // 거주 요건 판정에 거주기간이 실제 사용됐는지 — 거주기간 산정의 초일 산입 방식이
  // 확인되지 않은 한계를 화면이 조건부로 안내할 수 있게 결과에 담는다
  let residenceYearsUsed: number | null = null

  // 장기보유특별공제 물건별 한도(transfer.ltsd.cap — 개정안 룰) 적용 여부.
  // 비과세·양도차손 등 조기 반환 경로에서도 결과에 담기므로 여기서 미리 선언한다
  let ltsdCapApplied = false

  // ── 비과세 판정 (③의 비과세 축 — 거주 요건은 '취득 당시' 조정대상지역인 경우만) ──
  let taxableRatio = 1
  let highPriceApplied = false
  let exemptionQualified = false
  if (effectiveOneHouse) {
    const exemptionRule = requireRule(rules, TRANSFER_RULE_KEYS.exemption, input.baseDate)
    if (!exemptionRule.ok) return exemptionRule
    const exemption = parseTransferExemption(exemptionRule.rule.rule_value, exemptionRule.rule.rule_key)
    if (!exemption.ok) return exemption
    use(exemptionRule.rule)

    if (yearsForExemption >= exemption.value.minHoldingYears) {
      // 취득 당시 조정대상지역 여부 — 과거 이력이 없어 자동 판정 불가, 사용자가 직접 선택 (④의 비과세 축)
      if (input.acquiredInRegulatedArea === undefined) {
        return engineFail(
          'INVALID_INPUT',
          '1세대 1주택 비과세 판정에는 취득 당시 조정대상지역 여부 선택이 필요합니다. 취득 시점의 지정 여부는 국토교통부 공고 또는 관할 시·군·구에서 확인할 수 있습니다.',
        )
      }
      let residenceOk = true
      if (input.acquiredInRegulatedArea === true) {
        if (input.residenceYears === undefined) {
          return engineFail('INVALID_INPUT', '취득 당시 조정대상지역이었던 주택의 비과세 판정에는 거주기간 입력이 필요합니다.')
        }
        residenceOk = input.residenceYears >= exemption.value.residenceIfAcquiredRegulated.minYears
        residenceYearsUsed = input.residenceYears
      }
      exemptionQualified = residenceOk
    }

    if (exemptionQualified) {
      const threshold = exemption.value.highPriceThreshold
      if (input.transferPrice <= threshold) {
        // 전액 비과세 — 세금 없음과 그 사유를 명확히 반환한다
        const netProceeds = input.transferPrice - input.acquirePrice - expenses
        const reasonParts = [
          '1세대 1주택 비과세 요건(보유' +
            (input.acquiredInRegulatedArea === true ? '·거주' : '') +
            ' 요건)을 충족하고,',
          `양도가액이 고가주택 기준(${threshold.toLocaleString('ko-KR')}원) 이하입니다.`,
          temporaryApplied ? '(일시적 2주택 요건 충족으로 1주택으로 보아 판정)' : '',
        ]
        return buildSuccess({
          exempt: true,
          exemptReason: reasonParts.filter(Boolean).join(' '),
          highPriceApplied: false,
          taxableRatio: 0,
          breakdown: {
            transferGain: 0, ltsdAmount: 0, taxableGain: 0, basicDeduction: 0, taxBase: 0,
            transferTax: 0, localIncomeTax: 0, totalTax: 0, netProceeds,
          },
          ltsdTable: 'none',
          ltsdReason: '비과세라 장기보유특별공제를 적용할 필요가 없습니다.',
          heavyApplied: false, heavyExemptedByGrace: false,
          heavyReason: '비과세라 중과 판정이 적용되지 않습니다.',
          ratePathChosen: 'base', comparisonApplied: false,
        })
      }
      // 고가주택 — 기준 초과분에 해당하는 비율만 과세 (양도차익·장기보유특별공제 양쪽에 적용)
      highPriceApplied = true
      taxableRatio = (input.transferPrice - threshold) / input.transferPrice
    }
  }

  // ── 양도차익 ────────────────────────────────────────────────────────────────
  const rawGain = input.transferPrice - input.acquirePrice - expenses
  if (rawGain <= 0) {
    // 양도차손 — 세액 없음(비과세와는 다른 사유임을 명확히)
    const netProceeds = input.transferPrice - input.acquirePrice - expenses
    return buildSuccess({
      exempt: false, exemptReason: null,
      highPriceApplied, taxableRatio: highPriceApplied ? taxableRatio : 1,
      breakdown: {
        transferGain: rawGain, ltsdAmount: 0, taxableGain: rawGain, basicDeduction: 0, taxBase: 0,
        transferTax: 0, localIncomeTax: 0, totalTax: 0, netProceeds,
      },
      ltsdTable: 'none', ltsdReason: '양도차익이 없어(양도차손) 공제를 적용하지 않았습니다.',
      heavyApplied: false, heavyExemptedByGrace: false, heavyReason: '양도차익이 없어 중과 판정이 의미가 없습니다.',
      ratePathChosen: 'base', comparisonApplied: false,
    })
  }
  const gain = Math.floor(rawGain * taxableRatio)

  // 판정 컨텍스트 — 행(when) 조건은 이 필드들만 쓸 수 있다
  const context: Record<string, Json | undefined> = {
    house_count: input.houseCount,            // 보유 주택 수 (3 = 3주택 이상)
    is_regulated: regulatedAtTransfer,        // '양도 당시' 조정대상지역 여부
    holding_years: yearsForRate,              // 세율용 보유기간 (§104②)
    holding_years_ltsd: yearsForLtsd,         // 장기보유특별공제용 보유기간 (§95④)
    residence_years: input.residenceYears,    // 거주기간 — 미입력이면 미확정
    sido: input.sido,                         // 시·도 이름 — 경과조치 지역 조건
    sigungu: input.sigungu,                   // 시·군·구 이름 — 경과조치의 구 단위 지역 조건
    is_metro: isMetro,                        // 수도권 여부 — metro_scope 룰 필요
    transfer_price: input.transferPrice,      // 양도가액 (원) — 신 형식 기본공제 등 조건용
  }

  // ── 다주택 중과 판정 + 경과조치 (유예 기간은 heavy 룰의 시행기간 이력이 표현) ──
  let heavyPoints = 0
  let heavyApplied = false
  let heavyExemptedByGrace = false
  let heavyReason = '중과 대상이 아닙니다.'
  if (!effectiveOneHouse && input.houseCount >= 2 && regulatedAtTransfer) {
    const heavyRule = rules.get(TRANSFER_RULE_KEYS.heavy)
    if (!heavyRule) {
      heavyReason = '양도일 기준 유효한 다주택 중과 룰이 없어 중과를 적용하지 않았습니다(중과 유예 기간은 룰 시행기간으로 관리됩니다).'
    } else {
      const heavy = parseTransferHeavy(heavyRule.rule_value, heavyRule.rule_key)
      if (!heavy.ok) return heavy
      const picked = selectRateRowOptional(heavy.value.rows, context, heavyRule.rule_key)
      if (!picked.ok) return picked
      picked.unresolved.forEach((f) => unresolvedFields.add(f))
      use(heavyRule)
      if (picked.row === null) {
        heavyReason = '입력 조건에 해당하는 중과 가산 행이 없어 중과를 적용하지 않았습니다.'
      } else {
        heavyPoints = picked.row.addPercentPoints
        heavyApplied = true
        heavyReason = `조정대상지역(양도 당시) ${input.houseCount === 2 ? '2주택' : '3주택 이상'} — 기본세율에 ${heavyPoints}%p 가산.`
        // 경과조치 — 마감일 이전 계약 체결 + 계약금 수령 + 기한 내 양도면 중과를 면한다
        const grace = heavy.value.grace
        if (grace) {
          if (input.graceContractDate === undefined || input.graceDepositReceived === undefined) {
            unresolvedFields.add('grace_contract')
            heavyReason += ' (경과조치 해당 여부는 매매계약 체결일·계약금 수령 여부를 입력해야 판정됩니다)'
          } else if (
            input.graceDepositReceived === true &&
            input.graceContractDate <= grace.contractDeadline
          ) {
            const graceRow = selectRateRowOptional(grace.rows, context, heavyRule.rule_key)
            if (!graceRow.ok) return graceRow
            graceRow.unresolved.forEach((f) => unresolvedFields.add(f))
            if (graceRow.row !== null) {
              // 지역별 허용 '개월 수' 안에 양도했는지 — 개월 수·지역 구분은 전부 룰에서 온다
              const withinMonths = isOnOrBeforeMonthsAfter(input.graceContractDate, input.baseDate, graceRow.row.monthsFromContract)
              const withinFinal = grace.finalDeadline === undefined || input.baseDate <= grace.finalDeadline
              if (withinMonths && withinFinal) {
                heavyApplied = false
                heavyExemptedByGrace = true
                heavyPoints = 0
                heavyReason = `중과 경과조치 적용 — 마감일(${grace.contractDeadline}) 이전에 계약을 체결하고 계약금을 받았으며, 계약일부터 ${graceRow.row.monthsFromContract}개월 이내에 양도하여 중과가 면제됩니다.`
              } else {
                heavyReason += ' (경과조치 기한을 지나 양도해 중과가 유지됩니다)'
              }
            }
          }
        }
      }
    }
  }

  // ── 장기보유특별공제 (②) — 어느 표를 왜 썼는지 반드시 남긴다 ────────────────
  let ltsdTable: TransferLtsdTable = 'none'
  let ltsdReason = ''
  let ltsdPercentTotal = 0
  if (heavyApplied) {
    ltsdReason = '조정대상지역 다주택 중과 대상이라 장기보유특별공제가 적용되지 않습니다.'
  } else {
    // 큰 표(1세대 1주택 + 거주 요건 — 지역과 무관하게 항상 적용되는 거주 요건이다 ③)
    // 전제: 비과세 요건(§154① 기준 — 보유, 취득 당시 조정대상지역이면 거주까지)을 충족한
    // 1세대 1주택이어야 한다(고가주택이라 비과세를 못 받아도 요건 충족이면 큰 표 대상).
    // 요건 미충족(exemptionQualified=false)이면 거주기간과 무관하게 일반 표로 간다.
    let useOneHouseTable = false
    if (effectiveOneHouse && !exemptionQualified) {
      ltsdReason = '1세대 1주택이지만 비과세 요건(보유·거주 — 소득세법 §154① 기준)을 충족하지 못해 큰 표 대상이 아닙니다.'
    }
    if (effectiveOneHouse && exemptionQualified) {
      const oneRule = requireRule(rules, TRANSFER_RULE_KEYS.ltsdOneHouse, input.baseDate)
      if (!oneRule.ok) return oneRule
      const one = parseTransferLtsdOneHouse(oneRule.rule.rule_value, oneRule.rule.rule_key)
      if (!one.ok) return one
      if (input.residenceYears !== undefined) residenceYearsUsed = input.residenceYears
      if (input.residenceYears === undefined) {
        unresolvedFields.add('residence_years')
        ltsdReason = `거주기간 미입력으로 1세대 1주택 큰 표(거주 ${one.value.minResidenceYears}년 이상) 적용 여부를 판정하지 못해 일반 표를 적용했습니다.`
      } else if (input.residenceYears >= one.value.minResidenceYears) {
        useOneHouseTable = true
        // 보유 축(holdingRows) 생략 = 그 시행기간의 보유 기준 공제 폐지 — 0%로 계산하고 사유에 명시
        let holdPct = 0
        if (one.value.holdingRows) {
          const holdingPicked = selectRateRowOptional(one.value.holdingRows, context, oneRule.rule.rule_key)
          if (!holdingPicked.ok) return holdingPicked
          holdingPicked.unresolved.forEach((f) => unresolvedFields.add(f))
          holdPct = holdingPicked.row?.deductPercent ?? 0
        }
        const residencePicked = selectRateRowOptional(one.value.residenceRows, context, oneRule.rule.rule_key)
        if (!residencePicked.ok) return residencePicked
        residencePicked.unresolved.forEach((f) => unresolvedFields.add(f))
        use(oneRule.rule)
        const resPct = residencePicked.row?.deductPercent ?? 0
        ltsdPercentTotal = holdPct + resPct
        ltsdTable = 'one_house'
        ltsdReason = one.value.holdingRows
          ? `1세대 1주택이고 거주 요건(${one.value.minResidenceYears}년 이상)을 충족해 큰 표 적용 — 보유분 ${holdPct}% + 거주분 ${resPct}%.`
          : `1세대 1주택이고 거주 요건(${one.value.minResidenceYears}년 이상)을 충족해 큰 표 적용 — 거주분 ${resPct}% (이 시행기간의 큰 표에는 보유 기준 공제가 없습니다).`
      } else {
        ltsdReason = `거주기간이 ${one.value.minResidenceYears}년 미만이라 1세대 1주택 큰 표 대신 일반 표를 적용했습니다(큰 표의 거주 요건은 지역과 무관하게 항상 적용됩니다).`
      }
    }
    if (!useOneHouseTable) {
      const genRule = requireRule(rules, TRANSFER_RULE_KEYS.ltsdGeneral, input.baseDate)
      if (!genRule.ok) return genRule
      const gen = parseTransferLtsdGeneral(genRule.rule.rule_value, genRule.rule.rule_key)
      if (!gen.ok) return gen
      if (gen.value.format === 'holding_only') {
        const picked = selectRateRowOptional(gen.value.rows, context, genRule.rule.rule_key)
        if (!picked.ok) return picked
        picked.unresolved.forEach((f) => unresolvedFields.add(f))
        use(genRule.rule)
        if (picked.row === null) {
          ltsdTable = 'none'
          ltsdReason = (ltsdReason ? ltsdReason + ' ' : '') + '일반 표에서 보유기간 조건에 해당하는 행이 없어 공제가 없습니다.'
        } else {
          ltsdTable = 'general'
          ltsdPercentTotal = picked.row.deductPercent
          ltsdReason = (ltsdReason ? ltsdReason + ' ' : '') + `일반 표 적용 — 공제율 ${picked.row.deductPercent}%.`
        }
      } else {
        // 신 형식(개정안) — 보유분·거주분 중 높은 쪽 하나만 적용.
        // 보유 축(holdingRows) 생략 = 그 시행기간의 보유 기준 공제 폐지(거주 기준만).
        let holdPct = 0
        if (gen.value.holdingRows) {
          const holdingPicked = selectRateRowOptional(gen.value.holdingRows, context, genRule.rule.rule_key)
          if (!holdingPicked.ok) return holdingPicked
          holdingPicked.unresolved.forEach((f) => unresolvedFields.add(f))
          holdPct = holdingPicked.row?.deductPercent ?? 0
        }
        const residencePicked = selectRateRowOptional(gen.value.residenceRows, context, genRule.rule.rule_key)
        if (!residencePicked.ok) return residencePicked
        residencePicked.unresolved.forEach((f) => unresolvedFields.add(f))
        use(genRule.rule)
        const resPct = residencePicked.row?.deductPercent ?? 0
        if (input.residenceYears === undefined) {
          // 거주기간 미입력 — 0으로 간주하지 않고, 표의 구성에 맞는 사실을 명시한다
          ltsdPercentTotal = holdPct
          ltsdTable = holdPct > 0 ? 'general' : 'none'
          ltsdReason = (ltsdReason ? ltsdReason + ' ' : '') + (gen.value.holdingRows
            ? `거주기간 미입력으로 일반 표(개정안)의 보유 기준 공제만 적용했습니다 — 보유분 ${holdPct}%. ` +
              '거주기간을 입력하면 거주 기준 공제와 비교해 높은 쪽이 적용됩니다.'
            : '거주기간 미입력으로 공제를 적용하지 못했습니다 — 이 시행기간의 일반 표는 거주 기준 공제만 있습니다. 거주기간을 입력하면 공제가 반영됩니다.')
        } else {
          if (residencePicked.row !== null) residenceYearsUsed = input.residenceYears
          ltsdPercentTotal = Math.max(holdPct, resPct)
          ltsdTable = ltsdPercentTotal > 0 ? 'general' : 'none'
          if (gen.value.holdingRows) {
            // 동률이면 보유분으로 표기 — 공제액은 동일하다
            const chosen = resPct > holdPct ? '거주분' : '보유분'
            ltsdReason = (ltsdReason ? ltsdReason + ' ' : '') +
              `일반 표(개정안) 적용 — 보유분 ${holdPct}%·거주분 ${resPct}% 중 높은 쪽인 ${chosen} ${ltsdPercentTotal}%를 적용했습니다(둘 중 하나만 적용).`
            if (ltsdPercentTotal === 0) {
              ltsdReason += ' 보유·거주기간이 공제 요건에 해당하지 않아 공제가 없습니다.'
            }
          } else {
            ltsdReason = (ltsdReason ? ltsdReason + ' ' : '') +
              `일반 표(개정안) 적용 — 거주분 ${resPct}% (이 시행기간에는 보유 기준 공제가 없습니다).`
            if (ltsdPercentTotal === 0) {
              ltsdReason += ' 거주기간이 공제 요건에 해당하지 않아 공제가 없습니다.'
            }
          }
        }
      }
    }
  }
  let ltsdAmount = Math.floor((gain * ltsdPercentTotal) / 100)

  // ── 장기보유특별공제 물건별 한도 (transfer.ltsd.cap — 개정안 선택 룰) ────────
  // 기준일에 유효한 룰이 없으면 한도 없음(확정법에는 한도 규정이 없다). 같은 해 여러
  // 물건 양도 시의 '인별' 합산 한도는 단일 물건 계산기가 알 수 없어 적용하지 않는다 —
  // 화면 판단 한계가 그 사실을 안내한다.
  const capRule = rules.get(TRANSFER_RULE_KEYS.ltsdCap)
  if (capRule && ltsdAmount > 0) {
    const cap = parseTransferLtsdCap(capRule.rule_value, capRule.rule_key)
    if (!cap.ok) return cap
    use(capRule)
    if (ltsdAmount > cap.value.perPropertyAmount) {
      ltsdAmount = cap.value.perPropertyAmount
      ltsdCapApplied = true
      ltsdReason += ` 공제액이 물건별 한도를 넘어 한도액 ${cap.value.perPropertyAmount.toLocaleString('ko-KR')}원까지만 적용했습니다(개정안 기준).`
    }
  }

  // ── 기본공제 → 과세표준 ─────────────────────────────────────────────────────
  // 구 형식(확정법)은 고정 금액, 신 형식(개정안)은 행 조건(거주기간·양도가액 등)별 금액.
  const taxableGain = gain - ltsdAmount
  const basicRule = requireRule(rules, TRANSFER_RULE_KEYS.basicDeduction, input.baseDate)
  if (!basicRule.ok) return basicRule
  const basic = parseTransferBasicDeduction(basicRule.rule.rule_value, basicRule.rule.rule_key)
  if (!basic.ok) return basic
  use(basicRule.rule)
  let basicAmount: number
  if (basic.value.format === 'fixed') {
    basicAmount = basic.value.amount
  } else {
    const picked = selectRateRow(basic.value.rows, context, basicRule.rule.rule_key)
    if (!picked.ok) return picked
    picked.unresolved.forEach((f) => unresolvedFields.add(f))
    basicAmount = picked.row.amount
  }
  const basicApplied = Math.min(basicAmount, Math.max(taxableGain, 0))
  const taxBase = Math.max(taxableGain - basicApplied, 0)

  // ── 세율 적용 — 국세·지방 각각 독립 계산 (지방은 10% 부가가 아니라 별도 세율표) ──
  const baseRule = requireRule(rules, TRANSFER_RULE_KEYS.baseRates, input.baseDate)
  if (!baseRule.ok) return baseRule
  const base = parseTransferBaseRates(baseRule.rule.rule_value, baseRule.rule.rule_key)
  if (!base.ok) return base
  use(baseRule.rule)

  const shortRule = requireRule(rules, TRANSFER_RULE_KEYS.shortTermRates, input.baseDate)
  if (!shortRule.ok) return shortRule
  const short = parseTransferShortTerm(shortRule.rule.rule_value, shortRule.rule.rule_key)
  if (!short.ok) return short

  // 국세 — 기본(+중과 가산)과 단기 세율을 비교해 큰 세액을 택한다(비교과세)
  let mainSpec: RateSpec = base.value.rate
  if (heavyApplied) {
    const added = addPointsToRateSpec(base.value.rate, heavyPoints)
    if (added === null) {
      return engineFail('RULE_VALUE_INVALID',
        `룰('${baseRule.rule.rule_key}')의 세율 유형에는 중과 가산을 적용할 수 없습니다. 기본세율을 fixed 또는 progressive로 등록해 주세요.`,
        baseRule.rule.rule_key)
    }
    mainSpec = added
  }
  const mainAmount = evaluateRateSpec(mainSpec, taxBase)
  const shortPicked = selectRateRowOptional(short.value.rows, context, shortRule.rule.rule_key)
  if (!shortPicked.ok) return shortPicked
  shortPicked.unresolved.forEach((f) => unresolvedFields.add(f))
  let shortAmount: number | null = null
  if (shortPicked.row !== null) {
    use(shortRule.rule)
    shortAmount = evaluateRateSpec(shortPicked.row.rate, taxBase)
  }
  const comparisonApplied = shortAmount !== null
  const nationalRaw = shortAmount !== null ? Math.max(mainAmount, shortAmount) : mainAmount
  const ratePathChosen: TransferRatePath =
    shortAmount !== null && shortAmount >= mainAmount ? 'short_term' : heavyApplied ? 'heavy' : 'base'

  // 지방소득세 — 같은 과세표준에 별도 세율표(독립 세목). 국세가 단기·중과 경로인데
  // 지방 대응 표가 없으면 국세의 1/10로 추정하지 않고 중단한다.
  const localRule = requireRule(rules, TRANSFER_RULE_KEYS.localIncomeTax, input.baseDate)
  if (!localRule.ok) return localRule
  const local = parseTransferLocalIncomeTax(localRule.rule.rule_value, localRule.rule.rule_key)
  if (!local.ok) return local
  use(localRule.rule)
  let localMainSpec: RateSpec = local.value.rate
  if (heavyApplied) {
    if (!local.value.heavyRows) {
      return engineFail('RULE_VALUE_INVALID',
        `룰('${localRule.rule.rule_key}')에 다주택 중과 대응(heavyRows)이 없어 지방소득세를 계산할 수 없습니다. 국세의 10%로 추정하지 않습니다.`,
        localRule.rule.rule_key)
    }
    const localHeavy = selectRateRowOptional(local.value.heavyRows, context, localRule.rule.rule_key)
    if (!localHeavy.ok) return localHeavy
    if (localHeavy.row === null) {
      return engineFail('RULE_VALUE_INVALID',
        `룰('${localRule.rule.rule_key}')의 중과 대응(heavyRows)에 입력 조건에 맞는 행이 없습니다.`,
        localRule.rule.rule_key)
    }
    const addedLocal = addPointsToRateSpec(local.value.rate, localHeavy.row.addPercentPoints)
    if (addedLocal === null) {
      return engineFail('RULE_VALUE_INVALID',
        `룰('${localRule.rule.rule_key}')의 세율 유형에는 중과 가산을 적용할 수 없습니다.`,
        localRule.rule.rule_key)
    }
    localMainSpec = addedLocal
  }
  const localMainAmount = evaluateRateSpec(localMainSpec, taxBase)
  let localFinalRaw = localMainAmount
  if (shortPicked.row !== null) {
    if (!local.value.shortTerm) {
      return engineFail('RULE_VALUE_INVALID',
        `룰('${localRule.rule.rule_key}')에 단기 보유 대응(shortTerm)이 없어 지방소득세를 계산할 수 없습니다. 국세의 10%로 추정하지 않습니다.`,
        localRule.rule.rule_key)
    }
    const localShort = selectRateRowOptional(local.value.shortTerm.rows, context, localRule.rule.rule_key)
    if (!localShort.ok) return localShort
    if (localShort.row === null) {
      return engineFail('RULE_VALUE_INVALID',
        `룰('${localRule.rule.rule_key}')의 단기 대응(shortTerm.rows)에 입력 조건에 맞는 행이 없습니다.`,
        localRule.rule.rule_key)
    }
    localFinalRaw = Math.max(localMainAmount, evaluateRateSpec(localShort.row.rate, taxBase))
  }

  // ── 단수 처리 (선택 룰 — 미등록 시 1원 버림) ───────────────────────────────
  let rounding: RoundingValue | null = null
  const roundingRule = rules.get(TRANSFER_RULE_KEYS.rounding)
  if (roundingRule) {
    const parsed = parseRounding(roundingRule.rule_value, roundingRule.rule_key)
    if (!parsed.ok) return parsed
    rounding = parsed.value
    use(roundingRule)
  }
  const transferTax = applyRounding(nationalRaw, rounding)
  const localIncomeTax = applyRounding(localFinalRaw, rounding)
  const totalTax = transferTax + localIncomeTax
  const netProceeds = input.transferPrice - input.acquirePrice - expenses - totalTax

  return buildSuccess({
    exempt: false, exemptReason: null,
    highPriceApplied, taxableRatio: highPriceApplied ? taxableRatio : 1,
    breakdown: {
      transferGain: gain, ltsdAmount, taxableGain, basicDeduction: basicApplied, taxBase,
      transferTax, localIncomeTax, totalTax, netProceeds,
    },
    ltsdTable, ltsdReason, ltsdPercentTotal,
    heavyApplied, heavyExemptedByGrace, heavyReason,
    ratePathChosen, comparisonApplied,
  })

  /** 공통 결과 조립 — 판정 값·근거·미확정 목록을 항상 함께 담는다 */
  function buildSuccess(partial: {
    exempt: boolean
    exemptReason: string | null
    highPriceApplied: boolean
    taxableRatio: number
    breakdown: TransferBreakdown
    ltsdTable: TransferLtsdTable
    ltsdReason: string
    ltsdPercentTotal?: number
    heavyApplied: boolean
    heavyExemptedByGrace: boolean
    heavyReason: string
    ratePathChosen: TransferRatePath
    comparisonApplied: boolean
  }): TransferSuccess {
    const appliedRules = Array.from(applied.values())
    return {
      ok: true,
      ...partial,
      ltsdPercentTotal: partial.ltsdPercentTotal ?? 0,
      ltsdCapApplied,
      holdingYearsForRate: yearsForRate,
      holdingYearsForLtsd: yearsForLtsd,
      residenceYearsUsed,
      regulatedAtTransfer,
      appliedRules,
      ruleMode: mode,
      containsProposedRule: appliedRules.some((r) => r.status === 'proposed'),
      unresolvedFields: Array.from(unresolvedFields),
    }
  }
}
