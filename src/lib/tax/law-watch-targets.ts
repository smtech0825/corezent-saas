/**
 * @파일: lib/tax/law-watch-targets.ts
 * @설명: 법령 개정 감시의 '무엇을 볼 것인가' 담당 — 감시 대상 목록을 만들고,
 *        그 (법령ID, 조번호)가 법제처에서 실제로 조회되는지 확인한다.
 *        (배치 진행·큐 저장은 law-watch.ts / law-watch-scan.ts가 맡는다)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchArticleHistory, normalizeLawId } from './law-api'

/** 감시 대상 한 줄 — (법령ID, 조번호)에 걸린 룰 목록 */
export interface WatchTarget {
  lawId: string
  articleNo: string
  ruleKeys: string[]
}

/**
 * 법제처에서 조회되지 않는 감시 대상 — 감시가 조용히 걸러지는 것을 막기 위해 알린다.
 * 법령ID가 틀렸을 수도, 조번호가 틀렸을 수도 있어 둘을 함께 담는다.
 */
export interface InvalidTarget {
  lawId: string
  articleNo: string
  ruleKeys: string[]
}

/** 법령ID나 조번호가 비어 감시 자체가 불가능한 룰 — 화면이 '감시 제외'로 밝힌다 */
export interface UnwatchableRule {
  ruleKey: string
  lawName: string
  reason: '법령ID 없음' | '조문번호 없음'
}

/** 감시 대상과 '감시할 수 없는 룰' 목록 */
export interface WatchScope {
  targets: WatchTarget[]
  unwatchable: UnwatchableRule[]
}

/** tax_rules에서 읽는 최소 컬럼 */
interface RuleRow {
  rule_key: string
  law_name: string
  law_id: string | null
  law_article_no: string | null
}

/**
 * @함수명: loadWatchScope
 * @설명: 등록된 룰에서 감시 대상을 만들고, 법령ID나 조번호가 비어 감시할 수 없는 룰도
 *        함께 돌려줍니다. 빠진 룰을 조용히 버리지 않고 화면이 밝히도록 하기 위해서입니다
 *        — 잘못된 법령ID는 경고하면서 비어 있는 법령ID는 무표시라면, 초록불만 보고
 *        안심하게 됩니다.
 * @매개변수: supabase - 관리자 클라이언트
 * @반환값: 감시 대상 목록과 감시 불가 룰 목록
 */
export async function loadWatchScope(supabase: SupabaseClient): Promise<WatchScope> {
  const { data, error } = await supabase
    .from('tax_rules')
    .select('rule_key, law_name, law_id, law_article_no')
    .range(0, 4999)

  if (error) throw new Error(`감시 대상 조회에 실패했습니다: ${error.message}`)

  const map = new Map<string, WatchTarget>()
  const unwatchable: UnwatchableRule[] = []
  const seenUnwatchable = new Set<string>()

  for (const row of (data ?? []) as RuleRow[]) {
    const lawId = row.law_id?.trim() ?? ''
    const articleNo = row.law_article_no?.trim() ?? ''

    if (lawId === '' || articleNo === '') {
      // 같은 룰 키가 시행 기간별로 여러 행이라 한 번만 담는다
      if (!seenUnwatchable.has(row.rule_key)) {
        seenUnwatchable.add(row.rule_key)
        unwatchable.push({
          ruleKey: row.rule_key,
          lawName: row.law_name,
          reason: lawId === '' ? '법령ID 없음' : '조문번호 없음',
        })
      }
      continue
    }

    const id = normalizeLawId(lawId)
    const key = `${id}|${articleNo}`
    const found = map.get(key)
    if (found) {
      if (!found.ruleKeys.includes(row.rule_key)) found.ruleKeys.push(row.rule_key)
    } else {
      map.set(key, { lawId: id, articleNo, ruleKeys: [row.rule_key] })
    }
  }
  return { targets: [...map.values()], unwatchable }
}

/**
 * @함수명: verifyWatchTargets
 * @설명: 감시 대상 (법령ID, 조번호)가 법제처에서 실제로 조회되는지 확인합니다.
 *
 *        조문 변경 이력(lsJoHstInf)으로 확인합니다. 법령 전문 조회(target=law)보다
 *        훨씬 가볍고, **법령ID와 조번호를 한 번에** 검증합니다 — 둘 중 하나라도 틀리면
 *        이력이 0건으로 오기 때문입니다. 실재하는 조문은 최소한 제정 이력 1건을 가집니다.
 *
 *        2026-08-16에 법령ID 12개 중 5개가 실제로 틀려 룰 35건이 오류 없이 감시에서
 *        빠져 있었습니다. 같은 일이 다시 없도록 확인하고 결과를 알립니다.
 * @매개변수: oc - 인증키 / targets - 감시 대상 / shouldStop - 시간 상한 판정 함수
 * @반환값: 조회되지 않은 대상 목록과 확인을 끝내지 못했는지 여부
 */
export async function verifyWatchTargets(
  oc: string,
  targets: WatchTarget[],
  shouldStop: () => boolean,
): Promise<{ invalid: InvalidTarget[]; unchecked: number; incomplete: boolean }> {
  const invalid: InvalidTarget[] = []
  let unchecked = 0

  for (const t of targets) {
    // 남은 시간이 없으면 확인을 중단한다 — 확인 때문에 감지 자체가 밀리면 안 된다
    if (shouldStop()) return { invalid, unchecked, incomplete: true }
    try {
      // 없는 법령ID·없는 조문번호는 오류가 아니라 totalCnt 0으로 온다(실측 확인).
      // 즉 이력 0건은 '그 조합이 없다'는 뜻이다.
      const history = await fetchArticleHistory(oc, t.lawId, t.articleNo)
      if (history.length === 0) {
        invalid.push({ lawId: t.lawId, articleNo: t.articleNo, ruleKeys: t.ruleKeys })
      }
    } catch {
      // 확인 자체가 실패한 대상은 '없는 대상'으로 단정하지 않는다(잘못된 경고 방지).
      // 다만 루프를 멈추지도 않는다 — 한 건 때문에 나머지 확인을 통째로 잃으면
      // 정작 잡아야 할 잘못된 ID가 묻힌다.
      unchecked++
    }
  }
  return { invalid, unchecked, incomplete: false }
}
