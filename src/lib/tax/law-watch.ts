/**
 * @파일: lib/tax/law-watch.ts
 * @설명: 법령 개정 자동 감시 배치의 본체.
 *
 *        동작 순서
 *          1. tax_law_watch_state(단일 행)에서 어디까지 처리했는지 읽는다.
 *          2. 비어 있으면(첫 가동) 과거를 훑지 않고 오늘로 기준선만 세우고 끝낸다.
 *          3. 그다음 날부터 오늘까지 빠진 날짜를 하루씩 순회한다.
 *             - lsHstInf로 그날 바뀐 법령을 받아 감시 대상이 아니면 버린다.
 *             - 걸리면 lsJoHstInf로 그 조문이 그 개정에서 실제로 바뀌었는지 확인한다.
 *             - 바뀌었으면 큐에 넣는다(어느 룰에 걸리는지 함께 저장).
 *          4. 성공한 날짜까지만 last_checked_date를 올린다.
 *             실패하면 그 앞까지만 올리고 오류를 기록한다 — 실패한 날을 건너뛰면
 *             그날 개정을 영영 놓치기 때문이다.
 *
 *        한 번 실행에 도는 날짜 수와 시간에 상한이 있다. 밀린 날짜가 많으면
 *        나눠 처리하고 다음 실행이 이어받는다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadWatchTargets,
  verifyLawIds,
  type InvalidLawId,
  type WatchTarget,
} from './law-watch-targets'
import { fetchArticleHistory, fetchLawChangesOn, getLawApiOc, LawApiError } from './law-api'

export type { InvalidLawId } from './law-watch-targets'

/** 한 번 실행에 처리할 최대 날짜 수 — 밀려도 나눠 처리하고 다음 실행이 이어받는다 */
const MAX_DAYS_PER_RUN = 10

/** 한 번 실행의 목표 시간(ms). 넘기면 그날까지만 처리하고 멈춘다(함수 시간 제한 방어) */
const SOFT_DEADLINE_MS = 45_000


/** 배치 실행 결과 — 라우트가 그대로 응답으로 내보낸다 */
export interface WatchRunResult {
  ok: boolean
  mode: 'baseline' | 'scan'
  message: string
  targetCount: number
  datesPlanned: number
  datesProcessed: string[]
  queuedCount: number
  lastCheckedDate: string | null
  /** 법제처에서 조회되지 않은 법령ID — 있으면 그 룰들은 감시되지 않는다 */
  invalidLawIds: InvalidLawId[]
  /** 실패 시에만 — 법제처 응답 원문 일부를 그대로 담는다 */
  errorDetail?: { url: string; status: number | null; body: string }
}

/** YYYY-MM-DD (UTC 기준이 아니라 한국 날짜로 다룬다 — 법령 시행일이 한국 날짜다) */
function todayInKorea(): string {
  const now = new Date()
  // UTC+9로 옮긴 뒤 날짜만 취한다
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/** 날짜 문자열에 하루를 더한다 */
function addDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** 날짜 문자열에서 하루를 뺀다 */
function subDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** 상태 행 갱신 — 성공/실패 공통 */
async function saveState(
  supabase: SupabaseClient,
  patch: { last_checked_date?: string | null; last_run_ok: boolean; last_error: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('tax_law_watch_state')
    .update({ ...patch, last_run_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw new Error(`감시 상태 저장에 실패했습니다: ${error.message}`)
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
 * @매개변수: supabase·oc·date·targets - 클라이언트/인증키/날짜/감시 대상
 * @반환값: 새로 큐에 넣은 건수
 */
async function processOneDay(
  supabase: SupabaseClient,
  oc: string,
  date: string,
  targets: WatchTarget[],
): Promise<number> {
  const changes = await fetchLawChangesOn(oc, date)
  if (changes.length === 0) return 0

  // 감시 대상 법령만 남긴다 — 그날 바뀐 법령 대부분은 우리와 무관하다
  const watchedLawIds = new Set(targets.map((t) => t.lawId))
  const relevant = changes.filter((c) => watchedLawIds.has(c.lawId))
  if (relevant.length === 0) return 0

  let queued = 0
  for (const change of relevant) {
    const articles = targets.filter((t) => t.lawId === change.lawId)
    for (const target of articles) {
      const history = await fetchArticleHistory(oc, target.lawId, target.articleNo)
      // 그 개정(공포일자+공포번호)에서 이 조문이 실제로 바뀌었는지 — 공포번호가 개정 한 건을 특정한다
      const hit = history.find(
        (h) =>
          h.promulgationNo !== '' &&
          h.promulgationNo === change.promulgationNo &&
          h.promulgationDate === change.promulgationDate,
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
  return queued
}

/**
 * @함수명: runLawWatch
 * @설명: 감시 배치를 한 번 실행합니다. 실패해도 예외를 던지지 않고 결과 객체로 돌려주며,
 *        실패한 날짜는 last_checked_date에 반영하지 않습니다.
 * @매개변수: supabase - 관리자 클라이언트
 * @반환값: 실행 결과
 */
export async function runLawWatch(supabase: SupabaseClient): Promise<WatchRunResult> {
  const startedAt = Date.now()
  const today = todayInKorea()

  const { data: state, error: stateError } = await supabase
    .from('tax_law_watch_state')
    .select('last_checked_date')
    .eq('id', 1)
    .single()

  if (stateError || !state) {
    return {
      ok: false, mode: 'scan',
      message: `감시 상태 행을 읽지 못했습니다(066 적용 여부를 확인하세요): ${stateError?.message ?? '행 없음'}`,
      targetCount: 0, datesPlanned: 0, datesProcessed: [], queuedCount: 0, lastCheckedDate: null,
      invalidLawIds: [],
    }
  }

  const lastChecked = (state as { last_checked_date: string | null }).last_checked_date

  // ── 첫 가동 — 과거는 훑지 않고 오늘로 기준선만 세운다(대표님 결정) ──────────
  if (lastChecked === null) {
    await saveState(supabase, { last_checked_date: today, last_run_ok: true, last_error: null })
    return {
      ok: true, mode: 'baseline',
      message: `첫 가동입니다. 과거는 훑지 않고 ${today}로 기준선을 세웠습니다. 다음 실행부터 그 이후 개정을 감지합니다.`,
      targetCount: 0, datesPlanned: 0, datesProcessed: [], queuedCount: 0, lastCheckedDate: today,
      invalidLawIds: [],
    }
  }

  // ── 처리할 날짜 목록 — 마지막 처리일 다음 날부터 '어제'까지, 상한까지만 ──────
  //    오늘은 일부러 제외한다. 오늘 늦게 공포되는 개정이 있는데 오늘을 처리 완료로
  //    올려 버리면 그 개정을 다시 볼 기회가 없다. 하루 늦게 보는 대신 빠뜨리지 않는다.
  const endDate = subDay(today)
  const pending: string[] = []
  for (let d = addDay(lastChecked); d <= endDate && pending.length < MAX_DAYS_PER_RUN; d = addDay(d)) {
    pending.push(d)
  }
  if (pending.length === 0) {
    await saveState(supabase, { last_run_ok: true, last_error: null })
    return {
      ok: true, mode: 'scan', message: `새로 볼 날짜가 없습니다(${lastChecked}까지 처리 완료).`,
      targetCount: 0, datesPlanned: 0, datesProcessed: [], queuedCount: 0, lastCheckedDate: lastChecked,
      invalidLawIds: [],
    }
  }

  let targets: WatchTarget[]
  let oc: string
  try {
    oc = getLawApiOc()
    targets = await loadWatchTargets(supabase)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await saveState(supabase, { last_run_ok: false, last_error: msg })
    return {
      ok: false, mode: 'scan', message: msg,
      targetCount: 0, datesPlanned: pending.length, datesProcessed: [], queuedCount: 0,
      lastCheckedDate: lastChecked, invalidLawIds: [],
    }
  }

  // ── 법령ID가 법제처에 실제로 있는지 확인 ────────────────────────────────────
  //    없는 ID는 그 법령이 개정돼도 목록에서 걸러져 오류 없이 조용히 감시가 빠진다.
  //    감지 자체는 계속 진행하되(나머지 법령은 정상이므로), 그 사실을 결과와
  //    상태에 남겨 관리자 화면이 띄우게 한다.
  let invalidLawIds: InvalidLawId[] = []
  try {
    invalidLawIds = await verifyLawIds(oc, targets)
  } catch (e) {
    // 확인 자체가 실패하면(법제처 장애 등) 감시를 멈춘다 — 잘못된 경고보다 낫다
    const msg = e instanceof Error ? e.message : String(e)
    await saveState(supabase, { last_run_ok: false, last_error: `법령ID 확인 실패: ${msg}` })
    return {
      ok: false, mode: 'scan', message: `법령ID 확인에 실패해 중단했습니다: ${msg}`,
      targetCount: targets.length, datesPlanned: pending.length, datesProcessed: [],
      queuedCount: 0, lastCheckedDate: lastChecked, invalidLawIds: [],
      ...(e instanceof LawApiError
        ? { errorDetail: { url: e.url.replace(/OC=[^&]*/, 'OC=***'), status: e.status, body: e.body } }
        : {}),
    }
  }

  /** 결과·상태에 함께 남길 경고 문구 (없으면 빈 문자열) */
  const invalidNotice =
    invalidLawIds.length === 0
      ? ''
      : ` ⚠️ 법제처에서 조회되지 않는 법령ID ${invalidLawIds.length}개(${invalidLawIds
          .map((v) => v.lawId)
          .join(', ')})가 있어 관련 룰 ${invalidLawIds.reduce((a, b) => a + b.ruleKeys.length, 0)}건은 감시되지 않습니다.`

  const processed: string[] = []
  let queuedCount = 0

  for (const date of pending) {
    // 시간 상한 — 넘기면 여기까지만 반영하고 다음 실행이 이어받는다
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) break
    try {
      queuedCount += await processOneDay(supabase, oc, date, targets)
      processed.push(date)
    } catch (e) {
      // 실패한 날짜는 반영하지 않는다 — 그 앞까지만 올리고 오류를 남긴다
      const msg = e instanceof Error ? e.message : String(e)
      const advanceTo = processed.length > 0 ? processed[processed.length - 1] : undefined
      await saveState(supabase, {
        ...(advanceTo ? { last_checked_date: advanceTo } : {}),
        last_run_ok: false,
        last_error: `${date} 처리 중 실패: ${msg}`,
      })
      return {
        ok: false, mode: 'scan',
        message: `${date} 처리 중 실패해 중단했습니다. 이 날짜는 다음 실행에서 다시 시도합니다.`,
        targetCount: targets.length, datesPlanned: pending.length, datesProcessed: processed,
        queuedCount, lastCheckedDate: advanceTo ?? lastChecked, invalidLawIds,
        ...(e instanceof LawApiError
          ? { errorDetail: { url: e.url.replace(/OC=[^&]*/, 'OC=***'), status: e.status, body: e.body } }
          : {}),
      }
    }
  }

  const advanceTo = processed.length > 0 ? processed[processed.length - 1] : lastChecked
  // 없는 법령ID가 있으면 실행은 성공이어도 '정상'으로 표시하지 않는다 —
  // 관리자 화면이 초록불만 보고 안심하면 안 되기 때문이다
  await saveState(supabase, {
    last_checked_date: advanceTo,
    last_run_ok: invalidLawIds.length === 0,
    last_error: invalidLawIds.length === 0 ? null : invalidNotice.trim(),
  })

  const remaining = pending.length - processed.length
  return {
    ok: invalidLawIds.length === 0, mode: 'scan',
    message:
      `${processed.length}일치를 처리해 ${queuedCount}건을 큐에 넣었습니다.` +
      (remaining > 0 ? ` ${remaining}일이 남아 다음 실행이 이어받습니다.` : '') +
      invalidNotice,
    targetCount: targets.length, datesPlanned: pending.length, datesProcessed: processed,
    queuedCount, lastCheckedDate: advanceTo, invalidLawIds,
  }
}
