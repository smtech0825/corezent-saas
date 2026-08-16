/**
 * @파일: lib/tax/law-watch-targets.ts
 * @설명: 법령 개정 감시의 '무엇을 볼 것인가' 담당 — 감시 대상 목록을 만들고,
 *        그 법령ID가 법제처에 실제로 있는지 확인한다.
 *        (배치 진행·큐 저장은 law-watch.ts가 맡는다 — 파일 300줄 기준을 지키려 나눴다)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchLawName } from './law-api'

/** 감시 대상 한 줄 — (법령ID, 조번호)에 걸린 룰 목록 */
export interface WatchTarget {
  lawId: string
  articleNo: string
  ruleKeys: string[]
}

/** 법제처에 없는 법령ID — 감시가 조용히 걸러지는 것을 막기 위해 별도로 알린다 */
export interface InvalidLawId {
  lawId: string
  ruleKeys: string[]
}

/**
 * @함수명: loadWatchTargets
 * @설명: 등록된 룰에서 법령ID와 6자리 조번호가 모두 있는 것만 모아 감시 대상을 만듭니다.
 *        둘 중 하나라도 비면 감시할 수 없으므로 제외합니다(어느 룰이 빠졌는지는
 *        관리자가 룰 화면에서 확인합니다).
 * @매개변수: supabase - 관리자 클라이언트
 * @반환값: (법령ID, 조번호)별 감시 대상 목록
 */
export async function loadWatchTargets(supabase: SupabaseClient): Promise<WatchTarget[]> {
  const { data, error } = await supabase
    .from('tax_rules')
    .select('rule_key, law_id, law_article_no')
    .not('law_id', 'is', null)
    .not('law_article_no', 'is', null)

  if (error) throw new Error(`감시 대상 조회에 실패했습니다: ${error.message}`)

  const map = new Map<string, WatchTarget>()
  for (const row of (data ?? []) as { rule_key: string; law_id: string; law_article_no: string }[]) {
    const key = `${row.law_id}|${row.law_article_no}`
    const found = map.get(key)
    if (found) {
      if (!found.ruleKeys.includes(row.rule_key)) found.ruleKeys.push(row.rule_key)
    } else {
      map.set(key, { lawId: row.law_id, articleNo: row.law_article_no, ruleKeys: [row.rule_key] })
    }
  }
  return [...map.values()]
}

/**
 * @함수명: verifyLawIds
 * @설명: 감시 대상의 법령ID가 법제처에 실제로 있는지 확인합니다.
 *        없는 ID는 그 법령이 개정돼도 목록에서 걸러져 **오류 없이 조용히** 감시가
 *        빠집니다. 2026-08-16에 12개 중 5개가 실제로 그런 상태였습니다 — 다시
 *        같은 일이 없도록 실행할 때마다 확인하고 결과에 담습니다.
 * @매개변수: oc - 인증키 / targets - 감시 대상 목록
 * @반환값: 조회되지 않은 법령ID 목록(빈 배열이면 전부 정상)
 */
export async function verifyLawIds(oc: string, targets: WatchTarget[]): Promise<InvalidLawId[]> {
  const byLawId = new Map<string, string[]>()
  for (const t of targets) {
    const keys = byLawId.get(t.lawId) ?? []
    for (const k of t.ruleKeys) if (!keys.includes(k)) keys.push(k)
    byLawId.set(t.lawId, keys)
  }

  const invalid: InvalidLawId[] = []
  for (const [lawId, ruleKeys] of byLawId) {
    // 확인 자체가 실패하면(법제처 장애 등) '없는 ID'로 단정하지 않는다 —
    // 감시가 멈추는 편이 잘못된 경고를 띄우는 것보다 낫다
    const name = await fetchLawName(oc, lawId)
    if (name === null) invalid.push({ lawId, ruleKeys })
  }
  return invalid
}

