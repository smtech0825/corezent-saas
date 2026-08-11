/**
 * @파일: lib/tax/rule-store.ts
 * @설명: 룰 저장소 조회 — 기준일에 유효한 룰 세트 로드(모드 우선순위·충돌 검출)와
 *        규제지역 판정. 엔진은 이 모듈을 통해서만 DB를 읽는다.
 *        ⚠️ 세율 숫자를 여기서 만들지 않는다. DB에 있는 값을 그대로 전달만 한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RegulatedAreaType, TaxRule, TaxRuleMode, TaxType } from './types'
import type { TaxEngineFailure } from './engine-types'

/** YYYY-MM-DD 형식 검사 — PostgREST 필터 문자열에 넣기 전에 반드시 통과해야 한다 */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/**
 * @함수명: isValidRegionCode
 * @설명: 지역 코드 형식 검사 — regions.ts의 buildRegionCode()가 만드는 '시·도|시·군·구'
 *        한글 코드를 허용한다. 쿼리에는 .eq()로만 전달되므로 문자 종류·길이만 제한한다.
 */
export function isValidRegionCode(value: string): boolean {
  return value.length >= 1 && value.length <= 40 && /^[가-힣A-Za-z0-9| -]+$/.test(value)
}

/** 실패 결과 생성 헬퍼 */
export function engineFail(
  code: TaxEngineFailure['code'],
  message: string,
  ruleKey?: string,
): TaxEngineFailure {
  return { ok: false, code, message, ruleKey }
}

export type RuleFetchResult =
  | { ok: true; rules: Map<string, TaxRule> }
  | TaxEngineFailure

/**
 * @함수명: fetchValidRules
 * @설명: 세목·기준일·룰 모드에 맞는 유효 룰을 rule_key별로 1건씩 확정해 반환합니다.
 *        - effective_from ≤ 기준일, effective_to는 NULL(무기한) 또는 기준일 이상(종료일 포함)
 *        - confirmed 모드: status=confirmed만
 *        - proposed 모드: confirmed+proposed 조회 후 같은 키에 둘 다 있으면 proposed 우선
 *        - 우선순위로도 같은 키에 2건 이상 남으면 계산하지 않고 RULE_CONFLICT를 반환합니다
 * @매개변수: supabase - Supabase 클라이언트 / taxType - 세목 / baseDate - 기준일 / mode - 룰 모드
 * @반환값: rule_key → 룰 1건의 Map, 또는 실패 결과
 */
export async function fetchValidRules(
  supabase: SupabaseClient,
  taxType: TaxType,
  baseDate: string,
  mode: TaxRuleMode,
): Promise<RuleFetchResult> {
  if (!isValidDateString(baseDate)) {
    return engineFail('INVALID_INPUT', '기준일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  }

  let query = supabase
    .from('tax_rules')
    .select('*')
    .eq('tax_type', taxType)
    .lte('effective_from', baseDate)
    .or(`effective_to.is.null,effective_to.gte.${baseDate}`)

  query =
    mode === 'confirmed'
      ? query.eq('status', 'confirmed')
      : query.in('status', ['confirmed', 'proposed'])

  const { data, error } = await query
  if (error) {
    console.error('[tax] 룰 조회 실패:', error.message)
    return engineFail('DB_ERROR', '룰 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }

  // rule_key별로 묶은 뒤 모드 우선순위로 1건 확정
  const byKey = new Map<string, TaxRule[]>()
  for (const row of (data ?? []) as TaxRule[]) {
    const list = byKey.get(row.rule_key)
    if (list) list.push(row)
    else byKey.set(row.rule_key, [row])
  }

  const resolved = new Map<string, TaxRule>()
  for (const [key, list] of byKey) {
    const proposed = list.filter((r) => r.status === 'proposed')
    const confirmed = list.filter((r) => r.status === 'confirmed')
    // proposed 모드에서 개정안이 있으면 개정안 우선, 없으면 확정법
    const picked = mode === 'proposed' && proposed.length > 0 ? proposed : confirmed
    if (picked.length === 0) continue
    if (picked.length > 1) {
      return engineFail(
        'RULE_CONFLICT',
        `같은 룰 키('${key}')에 기준일(${baseDate}) 기준 유효한 룰이 ${picked.length}건 겹쳐 있어 계산을 중단했습니다. 관리자 화면에서 시행 기간을 정리해 주세요.`,
        key,
      )
    }
    resolved.set(key, picked[0])
  }

  return { ok: true, rules: resolved }
}

/**
 * @함수명: requireRule
 * @설명: 확정된 룰 세트에서 특정 rule_key를 꺼냅니다. 없으면 0원 계산 대신
 *        "해당 시점의 룰이 등록되지 않았습니다"를 명확히 반환합니다.
 * @매개변수: rules - fetchValidRules 결과 Map / ruleKey - 찾을 룰 키 / baseDate - 기준일(안내문용)
 * @반환값: 룰 1건 또는 RULE_NOT_REGISTERED 실패
 */
export function requireRule(
  rules: Map<string, TaxRule>,
  ruleKey: string,
  baseDate: string,
): { ok: true; rule: TaxRule } | TaxEngineFailure {
  const rule = rules.get(ruleKey)
  if (!rule) {
    return engineFail(
      'RULE_NOT_REGISTERED',
      `해당 시점(${baseDate})의 룰이 등록되지 않았습니다: '${ruleKey}'. 룰이 등록될 때까지 이 계산은 제공되지 않습니다.`,
      ruleKey,
    )
  }
  return { ok: true, rule }
}

/**
 * @함수명: isRegulatedArea
 * @설명: 규제지역 판정 — 지역코드·구분(area_type)·기준일로 tax_regulated_areas 이력을 찾습니다.
 *        지정일 ≤ 기준일이고 해제일이 NULL(현재 지정) 또는 기준일 이상이며,
 *        applies_to에 해당 세목(또는 'all')이 포함된 이력만 인정합니다.
 * @매개변수: supabase - 클라이언트 / regionCode - 행정구역 코드 / baseDate - 판정 기준일
 *            taxType - 세목 / areaType - adjustment(조정대상지역)·speculation(투기과열지구)
 * @반환값: { regulated: boolean } 또는 실패 결과
 */
export async function isRegulatedArea(
  supabase: SupabaseClient,
  regionCode: string,
  baseDate: string,
  taxType: TaxType,
  areaType: RegulatedAreaType,
): Promise<{ ok: true; regulated: boolean } | TaxEngineFailure> {
  if (!isValidDateString(baseDate)) {
    return engineFail('INVALID_INPUT', '기준일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  }
  if (!isValidRegionCode(regionCode)) {
    return engineFail('INVALID_INPUT', '지역 코드 형식이 올바르지 않습니다.')
  }

  const { data, error } = await supabase
    .from('tax_regulated_areas')
    .select('id')
    .eq('region_code', regionCode)
    .eq('area_type', areaType)
    .lte('designated_from', baseDate)
    .or(`designated_to.is.null,designated_to.gte.${baseDate}`)
    .overlaps('applies_to', [taxType, 'all'])
    .limit(1)

  if (error) {
    console.error('[tax] 규제지역 조회 실패:', error.message)
    return engineFail('DB_ERROR', '규제지역 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }

  return { ok: true, regulated: (data?.length ?? 0) > 0 }
}
