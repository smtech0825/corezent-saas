/**
 * @파일: lib/tax/acquisition.ts
 * @설명: 취득세 계산기 — 주택 유상취득(매매) + 주택 증여(무상취득).
 *        엔진은 세율을 모른다: 세율·공제·구간·기준액은 전부 DB(tax_rules)에서 읽고,
 *        규제지역 여부는 tax_regulated_areas 이력으로 판정한다.
 *        룰이 없으면 0원으로 계산하지 않고 RULE_NOT_REGISTERED를 반환한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json, TaxRule, TaxRuleMode } from './types'
import type {
  AcquisitionInput,
  AcquisitionResult,
  AppliedRuleInfo,
  GiftTaxBasis,
  RateTableRow,
  RoundingValue,
  TaxEngineFailure,
} from './engine-types'
import { COMMON_RULE_KEYS, engineFail, fetchValidRules, isRegulatedArea, isValidDateString, isValidRegionCode, requireRule } from './rule-store'
import {
  applyRounding,
  evaluateRateSpec,
  isDeemedGift,
  parseDeemedGiftThreshold,
  parseGiftHeavy,
  parseGiftTaxBase,
  parseMetroScope,
  parseRateTable,
  parseRounding,
  selectRateRow,
} from './rule-value'

/** 취득세 룰 키 — 식별자일 뿐이며 값은 관리자가 DB에 등록한다 */
export const ACQUISITION_RULE_KEYS = {
  onerousRates: 'acquisition.onerous.rates',            // 유상취득 세율표
  giftTaxBase: 'acquisition.gift.tax_base',             // 증여 과세표준 기준
  giftRates: 'acquisition.gift.rates',                  // 증여 기본 세율표
  giftHeavy: 'acquisition.gift.heavy',                  // 증여 중과 (공시가격 기준 + 중과 세율표)
  deemedGiftThreshold: 'acquisition.gift.deemed_gift_threshold', // 무상취득 간주 기준
  rounding: 'acquisition.rounding',                     // 단수 처리 (선택)
} as const

/** 룰 행을 결과 화면용 근거 정보로 변환 */
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
function validateInput(input: AcquisitionInput): TaxEngineFailure | null {
  if (!isValidDateString(input.baseDate)) {
    return engineFail('INVALID_INPUT', '취득일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  }
  if (!isValidRegionCode(input.regionCode)) {
    return engineFail('INVALID_INPUT', '소재지 지역 코드가 올바르지 않습니다.')
  }
  if (input.cause !== 'sale' && input.cause !== 'gift') {
    return engineFail('INVALID_INPUT', '취득 원인은 유상매매 또는 증여만 지원합니다.')
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return engineFail('INVALID_INPUT', '취득가액은 0 이상의 숫자여야 합니다.')
  }
  if (!Number.isInteger(input.houseCountAfter) || input.houseCountAfter < 1) {
    return engineFail('INVALID_INPUT', '취득 후 주택 수는 1 이상의 정수여야 합니다.')
  }
  if (input.areaSqm !== undefined && (!Number.isFinite(input.areaSqm) || input.areaSqm <= 0)) {
    return engineFail('INVALID_INPUT', '전용면적은 0보다 큰 숫자(㎡)여야 합니다.')
  }
  for (const [label, v] of [['시가인정액', input.marketValue], ['공시가격(시가표준액)', input.officialPrice]] as const) {
    if (v !== undefined && (!Number.isFinite(v) || v < 0)) {
      return engineFail('INVALID_INPUT', `${label}은 0 이상의 숫자여야 합니다.`)
    }
  }
  if (
    input.giftTaxBaseChoice !== undefined &&
    input.giftTaxBaseChoice !== 'market_value' &&
    input.giftTaxBaseChoice !== 'official_price'
  ) {
    return engineFail('INVALID_INPUT', '과세표준 기준 선택값이 올바르지 않습니다.')
  }
  return null
}

/** 선택된 세율 행으로 3개 세목을 각각 계산(감면 반영, 절사 전) */
function computeItems(row: RateTableRow, taxBase: number): Record<'acquisition' | 'local_education' | 'rural_special', number> {
  const items = {
    acquisition: evaluateRateSpec(row.rates.acquisition, taxBase),
    local_education: evaluateRateSpec(row.rates.local_education, taxBase),
    rural_special: evaluateRateSpec(row.rates.rural_special, taxBase),
  }
  if (row.credit) {
    items[row.credit.target] = Math.max(items[row.credit.target] - row.credit.amount, 0)
  }
  return items
}

/**
 * @함수명: calculateAcquisitionTax
 * @설명: 취득세를 계산합니다. 취득 원인에 따라 유상취득/무상취득(증여)으로 갈라지고,
 *        배우자·직계존비속 간 대가 지급 거래는 룰 기준(차액 금액·비율)에 따라
 *        무상취득으로 간주될 수 있습니다. 세액은 취득세 본세·지방교육세·농어촌특별세로
 *        분해해 반환하고, 적용된 룰의 법령 근거 목록을 함께 반환합니다.
 * @매개변수: supabase - Supabase 클라이언트(서버) / input - 계산 입력 / mode - 룰 모드
 * @반환값: 성공(세액 분해 + 근거) 또는 실패(한국어 안내)
 */
export async function calculateAcquisitionTax(
  supabase: SupabaseClient,
  input: AcquisitionInput,
  mode: TaxRuleMode,
): Promise<AcquisitionResult> {
  const inputError = validateInput(input)
  if (inputError) return inputError

  // 기준일에 유효한 룰 세트 로드 (모드 우선순위·충돌 검출 포함)
  const fetched = await fetchValidRules(supabase, 'acquisition', input.baseDate, mode)
  if (!fetched.ok) return fetched
  const rules = fetched.rules

  // 조정대상지역 판정 (취득세 세목 기준)
  const reg = await isRegulatedArea(supabase, input.regionCode, input.baseDate, 'acquisition', 'adjustment')
  if (!reg.ok) return reg
  const regulated = reg.regulated
  // 판정 근거가 일부 지역만 지정된 이력이면 그 사실을 결과에 담는다(화면이 한계를 밝힌다)
  const regulatedPartial = reg.partial

  // 계산에 실제 사용된 룰의 근거를 모은다 (중복 없이)
  const applied = new Map<string, AppliedRuleInfo>()
  const use = (rule: TaxRule) => applied.set(rule.id, toAppliedInfo(rule))

  // 값 미확정으로 판정하지 못한 조건 필드 — 결과에 담아 화면이 표시한다
  const unresolvedFields = new Set<string>()

  // ── 수도권 여부(is_metro) — region.metro_scope 룰(공통, tax_type='common')로 판정 ──
  // 룰이 없거나 시·도를 모르면 '미확정'으로 두고, is_metro 조건을 쓰는 행은 매칭되지 않는다.
  // 임의로 false로 간주하지 않는다 (수도권 시·도 목록은 코드에 없다 — 전부 관리자 입력).
  const sidoName = input.sido && input.sido.trim() !== '' ? input.sido : undefined
  let isMetro: boolean | undefined
  const metroRule = rules.get(COMMON_RULE_KEYS.metroScope)
  if (metroRule) {
    const scope = parseMetroScope(metroRule.rule_value, metroRule.rule_key)
    if (!scope.ok) return scope
    if (sidoName !== undefined) isMetro = scope.value.sidoNames.includes(sidoName)
  }

  // ── 전용면적 — 숫자(areaSqm)가 오면 기존 boolean 조건(area_over_85)도 함께 만든다 ──
  // 여기의 85는 세법 기준값이 아니라 'area_over_85'라는 기존 필드 이름 자체의 정의다
  // (설계 문서 Wave 1 지시 — 기존 룰 형식 호환용). 면적 기준 판정(60㎡·85㎡ 등)은
  // 룰이 area_sqm 필드에 min/max 조건을 걸어 수행하며, 기준 숫자는 룰 데이터에 있다.
  const areaOver85 = input.areaSqm !== undefined ? input.areaSqm > 85 : input.areaOver85

  // ── 취득 유형 결정 — 증여인데 대가가 있으면 간주 기준(룰)으로 판정 ──────────
  let causeApplied: 'onerous' | 'gift' = input.cause === 'sale' ? 'onerous' : 'gift'
  let deemedGift = false
  const related = input.donorRelation === 'spouse' || input.donorRelation === 'lineal'

  if (input.cause === 'gift' && related && input.price > 0) {
    const thresholdRule = requireRule(rules, ACQUISITION_RULE_KEYS.deemedGiftThreshold, input.baseDate)
    if (!thresholdRule.ok) return thresholdRule
    const threshold = parseDeemedGiftThreshold(thresholdRule.rule.rule_value, thresholdRule.rule.rule_key)
    if (!threshold.ok) return threshold
    if (input.marketValue === undefined) {
      return engineFail('INVALID_INPUT', '배우자·직계존비속 간 거래의 무상취득 간주 판정에는 시가인정액 입력이 필요합니다.')
    }
    use(thresholdRule.rule)
    deemedGift = isDeemedGift(threshold.value, input.marketValue, input.price)
    // 차액이 기준을 넘으면 무상취득으로 간주, 넘지 않으면 대가를 인정해 유상취득으로 계산
    causeApplied = deemedGift ? 'gift' : 'onerous'
  }

  // ── 과세표준·세율 행 결정 ───────────────────────────────────────────────────
  let taxBase: number
  let selectedRow: RateTableRow
  let giftTaxBaseUsed: GiftTaxBasis | undefined
  let giftTaxBaseChoice: { options: GiftTaxBasis[]; selected: GiftTaxBasis | null } | undefined

  if (causeApplied === 'onerous') {
    taxBase = input.price
    const ratesRule = requireRule(rules, ACQUISITION_RULE_KEYS.onerousRates, input.baseDate)
    if (!ratesRule.ok) return ratesRule
    const table = parseRateTable(ratesRule.rule.rule_value, ratesRule.rule.rule_key)
    if (!table.ok) return table

    // 판정 컨텍스트 — 세율표 행의 when 조건은 이 필드들만 쓸 수 있다 (undefined = 미확정)
    const context: Record<string, Json | undefined> = {
      price: input.price,
      house_count: input.houseCountAfter,
      is_regulated: regulated,
      area_over_85: areaOver85,
      first_home: input.firstHome ?? false,
      temporary_two_home: input.temporaryTwoHome ?? false,
      area_sqm: input.areaSqm,              // 전용면적(㎡) — 미입력이면 미확정
      official_price: input.officialPrice,  // 공시가격(시가표준액) — 저가주택 중과 제외 판정용. 미입력이면 미확정
      is_metro: isMetro,                    // 수도권 여부 — metro_scope 룰과 시·도가 있어야 확정
    }
    const picked = selectRateRow(table.rows, context, ratesRule.rule.rule_key)
    if (!picked.ok) return picked
    picked.unresolved.forEach((f) => unresolvedFields.add(f))
    use(ratesRule.rule)
    selectedRow = picked.row
  } else {
    // 증여 과세표준 기준(시가인정액/공시가격)은 시점에 따라 다르므로 룰에서 읽는다
    const baseRule = requireRule(rules, ACQUISITION_RULE_KEYS.giftTaxBase, input.baseDate)
    if (!baseRule.ok) return baseRule
    const baseSpec = parseGiftTaxBase(baseRule.rule.rule_value, baseRule.rule.rule_key)
    if (!baseSpec.ok) return baseSpec

    // ── 납세자 선택 가능 구간 판정 — 기준 금액·비교 대상·선택지는 전부 룰에서 온다 ──
    let usedBasis: GiftTaxBasis = baseSpec.value.base
    const choice = baseSpec.value.choice
    if (choice) {
      const basisValue =
        choice.basis === 'price' ? input.price
        : choice.basis === 'market_value' ? input.marketValue
        : input.officialPrice
      if (basisValue === undefined) {
        // 비교할 값이 미입력 — 선택 가능 여부를 판정하지 못했다.
        // 기본 기준으로 계산하되 판정 생략 사실을 결과에 남긴다 (조용히 넘어가지 않는다)
        unresolvedFields.add(choice.basis)
      } else if (basisValue <= choice.maxAmount) {
        const selected = input.giftTaxBaseChoice
        if (selected !== undefined) {
          if (!choice.options.includes(selected)) {
            return engineFail('INVALID_INPUT', '선택한 과세표준 기준은 이 구간에서 고를 수 있는 값이 아닙니다.')
          }
          usedBasis = selected
          giftTaxBaseChoice = { options: choice.options, selected }
        } else {
          // 선택값 없음 — 기본 기준으로 계산하고, 선택이 가능했다는 사실을 결과에 담는다
          giftTaxBaseChoice = { options: choice.options, selected: null }
        }
      }
      // 구간 밖이면 기본 기준 그대로
    }
    // 선택값을 보냈는데 선택 가능 구간이 아니면(룰에 구간 없음·판정 불가·구간 밖) 무시하지 않고 알린다
    if (input.giftTaxBaseChoice !== undefined && giftTaxBaseChoice?.selected == null) {
      return engineFail('INVALID_INPUT', '현재 조건에서는 과세표준 기준을 선택할 수 없습니다. 선택 없이 다시 계산해 주세요.')
    }

    if (usedBasis === 'market_value') {
      if (input.marketValue === undefined) {
        return engineFail('INVALID_INPUT', '증여 취득세 계산에는 시가인정액 입력이 필요합니다.')
      }
      taxBase = input.marketValue
    } else {
      if (input.officialPrice === undefined) {
        return engineFail('INVALID_INPUT', '증여 취득세 계산에는 공시가격(시가표준액) 입력이 필요합니다.')
      }
      taxBase = input.officialPrice
    }
    giftTaxBaseUsed = usedBasis
    use(baseRule.rule)

    // 규제지역이면 중과 룰로 판정 — 공시가격 기준액과 중과 세율표는 룰에서 온다.
    // 단 증여자가 1주택자면 중과에서 제외한다.
    let heavyRows: RateTableRow[] | null = null
    let heavyRuleKey = ''
    if (regulated) {
      const heavyRule = requireRule(rules, ACQUISITION_RULE_KEYS.giftHeavy, input.baseDate)
      if (!heavyRule.ok) return heavyRule
      const heavy = parseGiftHeavy(heavyRule.rule.rule_value, heavyRule.rule.rule_key)
      if (!heavy.ok) return heavy
      if (input.officialPrice === undefined) {
        return engineFail('INVALID_INPUT', '규제지역 증여의 중과 판정에는 공시가격 입력이 필요합니다.')
      }
      use(heavyRule.rule) // 중과 여부 판정 자체의 근거이므로 미적용이어도 근거에 포함
      if (input.officialPrice >= heavy.value.officialPriceMin) {
        if (input.donorIsSingleHomeOwner === undefined) {
          return engineFail('INVALID_INPUT', '규제지역 증여의 중과 판정에는 증여자 1주택자 여부 입력이 필요합니다.')
        }
        if (!input.donorIsSingleHomeOwner) {
          heavyRows = heavy.value.rows
          heavyRuleKey = heavyRule.rule.rule_key
        }
      }
    }

    const context: Record<string, Json | undefined> = {
      tax_base: taxBase,
      house_count: input.houseCountAfter,
      is_regulated: regulated,
      area_over_85: areaOver85,
      donor_relation: input.donorRelation ?? 'other',
      area_sqm: input.areaSqm,              // 전용면적(㎡) — 미입력이면 미확정
      official_price: input.officialPrice,  // 공시가격(시가표준액) — 미입력이면 미확정
      is_metro: isMetro,                    // 수도권 여부 — metro_scope 룰과 시·도가 있어야 확정
    }

    if (heavyRows) {
      const picked = selectRateRow(heavyRows, context, heavyRuleKey)
      if (!picked.ok) return picked
      picked.unresolved.forEach((f) => unresolvedFields.add(f))
      selectedRow = picked.row
    } else {
      const ratesRule = requireRule(rules, ACQUISITION_RULE_KEYS.giftRates, input.baseDate)
      if (!ratesRule.ok) return ratesRule
      const table = parseRateTable(ratesRule.rule.rule_value, ratesRule.rule.rule_key)
      if (!table.ok) return table
      const picked = selectRateRow(table.rows, context, ratesRule.rule.rule_key)
      if (!picked.ok) return picked
      picked.unresolved.forEach((f) => unresolvedFields.add(f))
      use(ratesRule.rule)
      selectedRow = picked.row
    }
  }

  // 선택된 행이 is_metro 조건을 썼다면 수도권 범위 룰도 계산 근거에 포함한다
  if (metroRule && 'is_metro' in selectedRow.when) use(metroRule)

  // ── 세액 계산 + 단수 처리 ───────────────────────────────────────────────────
  const raw = computeItems(selectedRow, taxBase)

  let rounding: RoundingValue | null = null
  const roundingRule = rules.get(ACQUISITION_RULE_KEYS.rounding)
  if (roundingRule) {
    const parsed = parseRounding(roundingRule.rule_value, roundingRule.rule_key)
    if (!parsed.ok) return parsed
    rounding = parsed.value
    use(roundingRule)
  }

  const acquisitionTax = applyRounding(raw.acquisition, rounding)
  const localEducationTax = applyRounding(raw.local_education, rounding)
  const ruralSpecialTax = applyRounding(raw.rural_special, rounding)

  const appliedRules = Array.from(applied.values())
  return {
    ok: true,
    causeApplied,
    deemedGift,
    taxBase,
    isRegulatedArea: regulated,
    regulatedPartial: regulatedPartial,
    breakdown: {
      acquisitionTax,
      localEducationTax,
      ruralSpecialTax,
      total: acquisitionTax + localEducationTax + ruralSpecialTax,
    },
    appliedRules,
    ruleMode: mode,
    containsProposedRule: appliedRules.some((r) => r.status === 'proposed'),
    unresolvedFields: Array.from(unresolvedFields),
    giftTaxBaseUsed,
    giftTaxBaseChoice,
  }
}
