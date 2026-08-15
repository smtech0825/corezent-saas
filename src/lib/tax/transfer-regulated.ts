/**
 * @파일: lib/tax/transfer-regulated.ts
 * @설명: '취득 당시' 조정대상지역 판정 — 1세대 1주택 비과세의 거주 요건이 이 값으로
 *        갈린다. 세 조건을 모두 만족할 때만 자동으로 판정한다:
 *          ① 이력 커버리지 시작일 룰(region.regulated_history_from)이 등록돼 있고
 *          ② 취득일이 그 시작일 이후이고
 *          ③ 그 시점 그 지역에 '부분 지정이 아닌' 이력 상태가 확인될 것
 *        하나라도 아니면 자동 판정하지 않고 사용자에게 직접 묻는다 — 근거 없이
 *        추정하면 거주 요건을 잘못 요구해 세금이 실제와 달라진다.
 *        ⚠️ 사용자가 값을 직접 넣었으면 그 값이 자동 판정보다 우선한다(사용자가 자기
 *        주택의 실제 사정을 더 정확히 알 수 있다 — 특히 일부 동만 지정된 구).
 *        날짜·지역은 전부 룰과 이력(DB)에서 온다 — 이 파일에 어떤 날짜도 넣지 않는다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AcquiredRegulatedUnavailableReason, TaxEngineFailure } from './engine-types'
import type { TaxRule } from './types'
import { COMMON_RULE_KEYS, findRegulatedAreaRecord } from './rule-store'
import { parseRegulatedHistoryFrom } from './rule-value'

/** 판정 결과 — 값이 정해졌을 때 */
export interface AcquiredRegulatedResolved {
  ok: true
  /** 취득 당시 조정대상지역이었는지 */
  value: boolean
  /** 값의 출처 — user는 사용자가 직접 지정, auto는 이력으로 판정 */
  source: 'user' | 'auto'
  /** 자동 판정이고 규제였을 때의 근거(지정일·공고 링크). 그 외에는 null */
  designatedFrom: string | null
  sourceUrl: string | null
}

/** 판정 결과 — 자동으로 정하지 못했고 사용자 입력도 없을 때 */
export interface AcquiredRegulatedUnresolved {
  ok: false
  reason: AcquiredRegulatedUnavailableReason
}

/**
 * @함수명: resolveAcquiredRegulated
 * @설명: 취득 당시 조정대상지역 여부를 정합니다. 사용자 입력이 있으면 그대로 쓰고,
 *        없으면 커버리지 룰·취득일·이력으로 자동 판정을 시도합니다.
 * @매개변수: supabase - 클라이언트 / rules - 기준일 유효 룰 세트(공통 룰 포함) /
 *            regionCode - 소재지 코드 / acquiredAt - 취득일(YYYY-MM-DD) /
 *            userValue - 사용자가 직접 지정한 값(없으면 undefined)
 * @반환값: 정해진 값(출처·근거 포함) / 못 정한 이유 / DB·룰 오류
 */
export async function resolveAcquiredRegulated(
  supabase: SupabaseClient,
  rules: Map<string, TaxRule>,
  regionCode: string,
  acquiredAt: string,
  userValue: boolean | undefined,
): Promise<AcquiredRegulatedResolved | AcquiredRegulatedUnresolved | TaxEngineFailure> {
  // 사용자 지정이 최우선 — 자동 판정을 시도하지 않는다
  if (userValue !== undefined) {
    return { ok: true, value: userValue, source: 'user', designatedFrom: null, sourceUrl: null }
  }

  // ① 커버리지 룰 — 없으면 자동 판정 자체가 꺼진 상태
  const coverageRule = rules.get(COMMON_RULE_KEYS.regulatedHistoryFrom)
  if (!coverageRule) return { ok: false, reason: 'no_coverage_rule' }
  const coverage = parseRegulatedHistoryFrom(coverageRule.rule_value, coverageRule.rule_key)
  if (!coverage.ok) return coverage

  // ② 취득일이 이력이 갖춰진 시점보다 이르면 '이력 없음'을 비규제로 읽을 수 없다
  if (acquiredAt < coverage.value.from) return { ok: false, reason: 'before_coverage' }

  // ③ 그 시점 이력 — 부분 지정만 있으면 구 단위로 판정할 수 없다
  const found = await findRegulatedAreaRecord(supabase, regionCode, acquiredAt, 'transfer', 'adjustment')
  if (!found.ok) return found
  const record = found.record
  if (record?.isPartial === true) return { ok: false, reason: 'partial_area' }

  // 이력이 없으면 커버리지 안이므로 '그때 비규제였다'로 읽는다
  return {
    ok: true,
    value: record !== null,
    source: 'auto',
    designatedFrom: record?.designatedFrom ?? null,
    sourceUrl: record?.sourceUrl ?? null,
  }
}
