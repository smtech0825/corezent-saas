/**
 * @파일: lib/tax/rule-store.ts
 * @설명: 룰 저장소 조회 — 기준일에 유효한 룰 세트 로드(모드 우선순위·충돌 검출)와
 *        규제지역 판정. 엔진은 이 모듈을 통해서만 DB를 읽는다.
 *        ⚠️ 세율 숫자를 여기서 만들지 않는다. DB에 있는 값을 그대로 전달만 한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RegulatedAreaType, TaxRule, TaxRuleMode, TaxType } from './types'
import type { RegulatedPartialInfo, TaxEngineFailure } from './engine-types'

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

/**
 * 세목 공통 룰 키 — tax_type='common'으로 저장되며(057), fetchValidRules가
 * 어떤 세목을 조회하든 항상 함께 로드한다. 특정 세목에 묻어 저장하면
 * 다른 세목 조회에서 빠지므로 반드시 'common'으로 등록해야 한다.
 */
export const COMMON_RULE_KEYS = {
  metroScope: 'region.metro_scope',   // 수도권으로 취급할 시·도 이름 목록 (관리자 입력)
  /**
   * 규제지역 이력이 언제부터 완전한지(커버리지 시작일). 값 형식 { "from": "YYYY-MM-DD" }.
   * 이 날짜 이후 시점만 '이력이 없다 = 그때 비규제였다'로 읽을 수 있다 — 그 전은
   * 이력을 아직 넣지 않은 구간이라 없다고 비규제로 단정하면 안 된다.
   * 룰이 없으면 자동 판정을 하지 않고 사용자에게 묻는다(값을 코드에 두지 않는다).
   */
  regulatedHistoryFrom: 'region.regulated_history_from',
} as const

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
 *        - 세목 공통 룰(tax_type='common' — 예: region.metro_scope)은 항상 함께 로드합니다
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
    .in('tax_type', [taxType, 'common'])
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
 * @함수명: fetchProposedEffectiveYears
 * @설명: 등록된 개정안(proposed) 룰의 시행 연도 목록을 조회합니다(중복 제거·오름차순) —
 *        연도별 비교 화면이 비교할 해를 코드가 아니라 데이터에서 알아내기 위한 조회입니다.
 *        개정안이 국회를 통과해 proposed 룰이 confirmed로 전환·정리되면 이 목록이 자연히
 *        줄어들고 비교 화면도 따라 접힙니다 — 코드 수정이 필요 없습니다.
 * @매개변수: supabase - Supabase 클라이언트 / taxType - 세목
 * @반환값: 시행 연도 오름차순 배열 또는 실패 결과
 */
export async function fetchProposedEffectiveYears(
  supabase: SupabaseClient,
  taxType: TaxType,
): Promise<{ ok: true; years: number[] } | TaxEngineFailure> {
  const { data, error } = await supabase
    .from('tax_rules')
    .select('effective_from')
    .eq('tax_type', taxType)
    .eq('status', 'proposed')

  if (error) {
    console.error('[tax] 개정안 시행 연도 조회 실패:', error.message)
    return engineFail('DB_ERROR', '개정안 시행 연도 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }

  const years = [
    ...new Set(
      ((data ?? []) as { effective_from: string }[])
        .map((row) => Number(String(row.effective_from).slice(0, 4)))
        .filter((y) => Number.isInteger(y) && y >= 1000 && y <= 9999),
    ),
  ].sort((a, b) => a - b)

  return { ok: true, years }
}

/** 규제지역 이력 한 건 — 자동 판정의 근거 표시에 필요한 값만 담는다 */
export interface RegulatedAreaRecord {
  designatedFrom: string
  designatedTo: string | null
  sourceUrl: string
  /** 시·군·구 일부(동·읍·면)만 지정된 이력인지 (065) */
  isPartial: boolean
}

/**
 * @함수명: findRegulatedAreaRecord
 * @설명: 규제지역 이력을 찾아 그 내용을 반환합니다 — isRegulatedArea가 boolean만
 *        주는 것과 달리, 자동 판정에 필요한 지정일·공고 링크·부분 지정 여부를 담습니다.
 *        조건은 isRegulatedArea와 같습니다(지정일 ≤ 기준일 < 해제일, applies_to에
 *        해당 세목 또는 'all').
 *        전체 지정(is_partial=false) 이력을 우선 반환합니다 — 같은 시점에 전체 지정
 *        이력이 있으면 부분 지정 이력이 있어도 자동 판정이 가능하기 때문입니다.
 * @매개변수: supabase - 클라이언트 / regionCode - 행정구역 코드 / baseDate - 판정 기준일 /
 *            taxType - 세목 / areaType - 규제 구분
 * @반환값: { record: 이력 또는 null(그 시점 지정 이력 없음) } 또는 실패 결과
 */
export async function findRegulatedAreaRecord(
  supabase: SupabaseClient,
  regionCode: string,
  baseDate: string,
  taxType: TaxType,
  areaType: RegulatedAreaType,
): Promise<{ ok: true; record: RegulatedAreaRecord | null } | TaxEngineFailure> {
  if (!isValidDateString(baseDate)) {
    return engineFail('INVALID_INPUT', '기준일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  }
  if (!isValidRegionCode(regionCode)) {
    return engineFail('INVALID_INPUT', '지역 코드 형식이 올바르지 않습니다.')
  }

  const { data, error } = await supabase
    .from('tax_regulated_areas')
    .select('designated_from, designated_to, source_url, is_partial')
    .eq('region_code', regionCode)
    .eq('area_type', areaType)
    .lte('designated_from', baseDate)
    .or(`designated_to.is.null,designated_to.gt.${baseDate}`)   // 해제일 당일은 이미 비규제
    .overlaps('applies_to', [taxType, 'all'])
    .order('is_partial', { ascending: true })   // 전체 지정 이력을 먼저
    .order('designated_from', { ascending: false })   // 동률이면 최근 지정 공고를 근거로 (isRegulatedArea와 같은 규칙)
    .limit(1)

  if (error) {
    console.error('[tax] 규제지역 이력 조회 실패:', error.message)
    return engineFail('DB_ERROR', '규제지역 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }

  const row = (data ?? [])[0] as
    | { designated_from: string; designated_to: string | null; source_url: string; is_partial: boolean }
    | undefined
  if (!row) return { ok: true, record: null }

  return {
    ok: true,
    record: {
      designatedFrom: row.designated_from,
      designatedTo: row.designated_to,
      sourceUrl: row.source_url,
      isPartial: row.is_partial === true,
    },
  }
}

/**
 * @함수명: isRegulatedArea
 * @설명: 규제지역 판정 — 지역코드·구분(area_type)·기준일로 tax_regulated_areas 이력을 찾습니다.
 *        지정일 ≤ 기준일 < 해제일(해제일 NULL이면 현재까지 지정)이고 applies_to에 해당
 *        세목(또는 'all')이 포함된 이력만 인정합니다.
 *        ⚠️ 해제일은 '그날부터 해제'라 당일은 이미 비규제다 — 앞 이력의 해제일과 뒤 이력의
 *        지정일이 같은 날인 전환 사례가 있어(고양 덕양구 2019-11-08 등) 해제일을 포함하면
 *        두 이력이 같은 날 동시에 잡히고, 그때 전체 지정이 부분 지정을 가려 버린다.
 *        ⚠️ 판정 근거가 '시·군·구 일부만 지정된 이력'(is_partial)이면 그 사실과 범위를
 *        함께 돌려준다 — 이 축(취득세 중과·양도 당시 중과)은 구 단위로 판정하므로,
 *        해당 주택이 지정 범위 밖이면 실제로는 규제지역이 아니고 세금이 더 낮다.
 *        판정값 자체는 바꾸지 않고 화면이 그 한계를 밝히게 한다.
 *        전체 지정 이력이 함께 있으면 그것을 우선하므로 경고가 뜨지 않는다.
 * @매개변수: supabase - 클라이언트 / regionCode - 행정구역 코드 / baseDate - 판정 기준일
 *            taxType - 세목 / areaType - adjustment(조정대상지역)·speculation(투기과열지구)
 * @반환값: { regulated, partial } 또는 실패 결과 (partial은 부분 지정이 아니면 null)
 */
export async function isRegulatedArea(
  supabase: SupabaseClient,
  regionCode: string,
  baseDate: string,
  taxType: TaxType,
  areaType: RegulatedAreaType,
): Promise<{ ok: true; regulated: boolean; partial: RegulatedPartialInfo | null } | TaxEngineFailure> {
  if (!isValidDateString(baseDate)) {
    return engineFail('INVALID_INPUT', '기준일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
  }
  if (!isValidRegionCode(regionCode)) {
    return engineFail('INVALID_INPUT', '지역 코드 형식이 올바르지 않습니다.')
  }

  const { data, error } = await supabase
    .from('tax_regulated_areas')
    .select('is_partial, note')
    .eq('region_code', regionCode)
    .eq('area_type', areaType)
    .lte('designated_from', baseDate)
    .or(`designated_to.is.null,designated_to.gt.${baseDate}`)   // 해제일 당일은 이미 비규제
    .overlaps('applies_to', [taxType, 'all'])
    .order('is_partial', { ascending: true })   // 전체 지정 이력을 먼저 — 있으면 경고 없음
    .order('designated_from', { ascending: false })   // 동률이면 최근 지정 공고를 근거로
    .limit(1)

  if (error) {
    console.error('[tax] 규제지역 조회 실패:', error.message)
    return engineFail('DB_ERROR', '규제지역 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }

  const row = (data ?? [])[0] as { is_partial: boolean; note: string | null } | undefined
  return {
    ok: true,
    regulated: row !== undefined,
    partial: row?.is_partial === true ? { note: row.note } : null,
  }
}
