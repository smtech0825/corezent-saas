/**
 * @파일: lib/tax/law-watch-scan.ts
 * @설명: 법령 개정 감시의 '하루치 처리' 담당 — 그날 바뀐 법령 중 감시 대상만 골라,
 *        그 조문이 실제로 바뀌었는지 확인하고 큐에 넣는다.
 *        (실행 흐름·상태 저장은 law-watch.ts가 맡는다)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { digitsOnly, fetchArticleHistory, fetchLawChangesOn } from './law-api'
import type { WatchTarget } from './law-watch-targets'

/** 하루치 처리 결과 — 화면·기록이 '봤는데 안 걸렸다'를 구분할 수 있게 건수를 함께 돌려준다 */
export interface DayScanResult {
  /** 그날 바뀐 법령 전체 건수 */
  changesSeen: number
  /** 그중 감시 대상이던 건수 */
  changesMatched: number
  /** 새로 큐에 넣은 건수 */
  queued: number
}

/**
 * @함수명: queueChange
 * @설명: 감지한 개정을 큐에 넣습니다. 이미 있으면(같은 법령ID·조번호·시행일) 조용히 넘어갑니다.
 *        중복 방지는 066의 UNIQUE 인덱스가 담당하며, 위반(23505)을 정상으로 취급합니다.
 * @매개변수: supabase - 관리자 클라이언트 / row - 큐에 넣을 값
 * @반환값: 새로 넣었으면 true, 이미 있었으면 false
 */
async function queueChange(
  supabase: SupabaseClient,
  row: {
    law_name: string
    law_id: string
    article_no: string
    effective_date: string | null
    change_type: string
    matched_rule_keys: string[]
    raw_payload: unknown
  },
): Promise<boolean> {
  const { error } = await supabase.from('tax_law_change_queue').insert(row)
  if (!error) return true
  // 23505 = unique_violation — 이미 담긴 개정이라 정상이다
  if (error.code === '23505') return false
  throw new Error(`개정 큐 저장에 실패했습니다: ${error.message}`)
}

/**
 * @함수명: processOneDay
 * @설명: 하루치를 처리합니다. 그날 바뀐 법령 중 감시 대상만 골라, 조문이 실제로
 *        바뀌었는지 확인한 뒤 큐에 넣습니다.
 *
 *        ⚠️ 두 API가 준 공포일자·공포번호를 대조할 때 반드시 숫자만 남겨 비교합니다.
 *        표기가 다르면(20260512 vs 2026-05-12, 04984 vs 4984) 모든 대조가 실패하는데,
 *        그 실패는 오류가 아니라 '해당 조문은 안 바뀜'으로 보여 개정이 통째로 사라집니다.
 * @매개변수: supabase·oc·date·targets - 클라이언트/인증키/날짜/감시 대상
 *            shouldStop - 시간 상한 판정 함수(넘으면 그 지점에서 오류를 던져 재시도시킨다)
 * @반환값: 그날의 처리 결과
 */
export async function processOneDay(
  supabase: SupabaseClient,
  oc: string,
  date: string,
  targets: WatchTarget[],
  shouldStop: () => boolean,
): Promise<DayScanResult> {
  const changes = await fetchLawChangesOn(oc, date, shouldStop)
  if (changes.length === 0) return { changesSeen: 0, changesMatched: 0, queued: 0 }

  // 감시 대상 법령만 남긴다 — 그날 바뀐 법령 대부분은 우리와 무관하다
  const watchedLawIds = new Set(targets.map((t) => t.lawId))
  const relevant = changes.filter((c) => watchedLawIds.has(c.lawId))
  if (relevant.length === 0) {
    return { changesSeen: changes.length, changesMatched: 0, queued: 0 }
  }

  // 대조에 쓸 공포번호가 비어 있으면 모든 대조가 실패하는데, 그 실패는 '이 조문은
  // 안 바뀜'과 구분되지 않아 개정이 통째로 사라진다. 응답 형식이 달라진 것이므로
  // 조용히 넘기지 않고 그날을 실패로 남겨 다시 시도하게 한다.
  const noNumber = relevant.filter((c) => digitsOnly(c.promulgationNo) === '')
  if (noNumber.length > 0) {
    throw new Error(
      `${date}: 감시 대상 법령 ${noNumber.length}건에 공포번호가 없어 조문 대조를 할 수 없습니다` +
        `(${noNumber.map((c) => c.lawName).join(', ')}). 응답 형식이 바뀌었을 수 있습니다.`,
    )
  }

  let queued = 0
  for (const change of relevant) {
    const articles = targets.filter((t) => t.lawId === change.lawId)
    for (const target of articles) {
      // 하루 안에서도 시간을 넘기면 멈춘다 — 여기서 던져야 그날이 처리 완료로
      // 올라가지 않고 다음 실행이 다시 시도한다(함수가 강제 종료되면 기록조차 못 남긴다)
      if (shouldStop()) {
        throw new Error(
          `시간 상한에 걸려 ${date} 처리를 마치지 못했습니다. 이 날짜는 다음 실행에서 다시 시도합니다.`,
        )
      }

      const history = await fetchArticleHistory(oc, target.lawId, target.articleNo)
      // 그 개정에서 이 조문이 실제로 바뀌었는지 — 공포번호가 개정 한 건을 특정한다.
      // 표기 차이를 없애려 양쪽 모두 숫자만 남겨 비교한다.
      const wantNo = digitsOnly(change.promulgationNo)
      const wantDate = digitsOnly(change.promulgationDate)
      const hit = history.find(
        (h) =>
          wantNo !== '' &&
          digitsOnly(h.promulgationNo) === wantNo &&
          digitsOnly(h.promulgationDate) === wantDate,
      )
      if (!hit) continue // 법령은 바뀌었지만 이 조문은 그대로 — 버린다

      const inserted = await queueChange(supabase, {
        law_name: change.lawName,
        law_id: change.lawId,
        article_no: target.articleNo,
        effective_date: hit.effectiveDate ?? change.effectiveDate,
        change_type: hit.changeType || change.changeType,
        matched_rule_keys: target.ruleKeys,
        raw_payload: { detectedOn: date, lawChange: change, articleHistory: hit },
      })
      if (inserted) queued++
    }
  }
  return { changesSeen: changes.length, changesMatched: relevant.length, queued }
}
