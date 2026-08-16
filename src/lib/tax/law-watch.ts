/**
 * @파일: lib/tax/law-watch.ts
 * @설명: 법령 개정 자동 감시 배치의 본체(실행 흐름·상태 저장).
 *
 *        동작 순서
 *          1. tax_law_watch_state(단일 행)에서 어디까지 처리했는지 읽는다.
 *          2. 비어 있으면(첫 가동) 과거를 훑지 않고 오늘로 기준선만 세우고 끝낸다.
 *          3. 그다음 날부터 '어제'까지 빠진 날짜를 하루씩 순회한다(오늘은 일부러 제외 —
 *             오늘 늦게 공포되는 개정을 놓치지 않기 위해서다).
 *          4. 성공한 날짜까지만 last_checked_date를 올린다. 실패하면 그 앞까지만
 *             올리고 오류를 기록한다 — 실패한 날을 건너뛰면 그날 개정을 영영 놓친다.
 *          5. 남은 시간이 있으면 감시 대상이 법제처에서 조회되는지 확인한다.
 *
 *        하루치 처리는 law-watch-scan.ts, 대상 조회·검증은 law-watch-targets.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getLawApiOc, LawApiError } from './law-api'
import { processOneDay } from './law-watch-scan'
import {
  loadWatchScope,
  verifyWatchTargets,
  type InvalidTarget,
  type UnwatchableRule,
  type WatchTarget,
} from './law-watch-targets'

export type { InvalidTarget, UnwatchableRule } from './law-watch-targets'

/**
 * 한 번 실행에 처리할 최대 날짜 수. 매일 도니 밀릴 일이 거의 없고, 밀려도 다음
 * 실행이 이어받는다 — 함수 시간 상한(60초)을 넘겨 강제 종료되는 쪽이 훨씬 나쁘다.
 */
const MAX_DAYS_PER_RUN = 3

/** 날짜 처리에 쓸 시간(ms). 넘기면 멈추고 다음 실행이 이어받는다 */
const SCAN_DEADLINE_MS = 30_000

/**
 * 대상 검증까지 포함한 전체 시간 상한(ms). 라우트의 maxDuration(60초)보다 짧게 둔다.
 * 여기서 통과한 직후 호출 하나가 최대 10초(law-api의 FETCH_TIMEOUT_MS) 걸리므로
 * 최악의 경우도 52초로, 강제 종료 전에 상태를 저장할 여유가 남는다.
 */
const TOTAL_DEADLINE_MS = 42_000

/** 배치 실행 결과 — 라우트가 그대로 응답으로 내보낸다 */
export interface WatchRunResult {
  ok: boolean
  mode: 'baseline' | 'scan'
  message: string
  targetCount: number
  datesPlanned: number
  datesProcessed: string[]
  /** endDate까지 아직 남은 날짜 수 (0이면 따라잡음) */
  datesRemaining: number
  queuedCount: number
  /** 처리한 날들에 바뀐 법령 총수 / 그중 감시 대상이던 수 */
  changesSeen: number
  changesMatched: number
  lastCheckedDate: string | null
  /** 법제처에서 조회되지 않은 감시 대상 — 있으면 그 룰들은 감시되지 않는다 */
  invalidTargets: InvalidTarget[]
  /** 법령ID·조문번호가 비어 감시 자체가 불가능한 룰 */
  unwatchableRules: UnwatchableRule[]
  /** 실패 시에만 — 법제처 응답 원문 일부(인증키는 가려져 있다) */
  errorDetail?: { url: string; status: number | null; body: string }
}

/** YYYY-MM-DD (한국 날짜로 다룬다 — 법령 시행일이 한국 날짜다. 한국은 서머타임 없음) */
function todayInKorea(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
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

/** 두 날짜 사이의 일수 (from 다음 날부터 to까지, 음수면 0) */
function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Number.isNaN(ms) ? 0 : Math.max(0, Math.round(ms / 86_400_000))
}

/** 상태 행 갱신 — 성공/실패 공통 */
async function saveState(
  supabase: SupabaseClient,
  patch: {
    last_checked_date?: string | null
    last_run_ok?: boolean
    last_error?: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from('tax_law_watch_state')
    .update({ ...patch, last_run_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw new Error(`감시 상태 저장에 실패했습니다: ${error.message}`)
}

/** 결과 기본값 — 반환 지점마다 빠뜨리지 않도록 한곳에 모은다 */
function emptyResult(overrides: Partial<WatchRunResult>): WatchRunResult {
  return {
    ok: true, mode: 'scan', message: '', targetCount: 0,
    datesPlanned: 0, datesProcessed: [], datesRemaining: 0, queuedCount: 0,
    changesSeen: 0, changesMatched: 0, lastCheckedDate: null,
    invalidTargets: [], unwatchableRules: [],
    ...overrides,
  }
}

/** 법제처 오류면 응답 원문을 보고용으로 붙인다(인증키는 law-api가 이미 가림) */
function detailOf(e: unknown): Pick<WatchRunResult, 'errorDetail'> {
  return e instanceof LawApiError
    ? { errorDetail: { url: e.url.replace(/OC=[^&]*/, 'OC=***'), status: e.status, body: e.body } }
    : {}
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
    return emptyResult({
      ok: false,
      message: `감시 상태 행을 읽지 못했습니다(066 적용 여부를 확인하세요): ${stateError?.message ?? '행 없음'}`,
    })
  }

  const lastChecked = (state as { last_checked_date: string | null }).last_checked_date

  // ── 첫 가동 — 과거는 훑지 않고 오늘로 기준선만 세운다(대표님 결정) ──────────
  if (lastChecked === null) {
    await saveState(supabase, { last_checked_date: today, last_run_ok: true, last_error: null })
    return emptyResult({
      mode: 'baseline',
      message: `첫 가동입니다. 과거는 훑지 않고 ${today}로 기준선을 세웠습니다. 다음 실행부터 그 이후 개정을 감지합니다.`,
      lastCheckedDate: today,
    })
  }

  // ── 처리할 날짜 목록 — 마지막 처리일 다음 날부터 '어제'까지, 상한까지만 ──────
  const endDate = subDay(today)
  const pending: string[] = []
  for (let d = addDay(lastChecked); d <= endDate && pending.length < MAX_DAYS_PER_RUN; d = addDay(d)) {
    pending.push(d)
  }

  if (pending.length === 0) {
    // 할 일이 없는 실행은 성공/오류 상태를 건드리지 않는다 —
    // 직전 실행이 남긴 경고를 덮어써 초록불로 만들면 안 되기 때문이다
    await saveState(supabase, {})
    return emptyResult({
      message: `새로 볼 날짜가 없습니다(${lastChecked}까지 처리 완료).`,
      lastCheckedDate: lastChecked,
    })
  }

  let scope: { targets: WatchTarget[]; unwatchable: UnwatchableRule[] }
  let oc: string
  try {
    oc = getLawApiOc()
    scope = await loadWatchScope(supabase)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await saveState(supabase, { last_run_ok: false, last_error: msg })
    return emptyResult({
      ok: false, message: msg, datesPlanned: pending.length, lastCheckedDate: lastChecked,
    })
  }

  const { targets, unwatchable } = scope
  const processed: string[] = []
  let queuedCount = 0
  let changesSeen = 0
  let changesMatched = 0

  for (const date of pending) {
    if (Date.now() - startedAt > SCAN_DEADLINE_MS) break
    try {
      const r = await processOneDay(supabase, oc, date, targets, () =>
        Date.now() - startedAt > SCAN_DEADLINE_MS,
      )
      queuedCount += r.queued
      changesSeen += r.changesSeen
      changesMatched += r.changesMatched
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
      return emptyResult({
        ok: false,
        message: `${date} 처리 중 실패해 중단했습니다. 이 날짜는 다음 실행에서 다시 시도합니다.`,
        targetCount: targets.length, datesPlanned: pending.length, datesProcessed: processed,
        datesRemaining: daysBetween(advanceTo ?? lastChecked, endDate),
        queuedCount, changesSeen, changesMatched,
        lastCheckedDate: advanceTo ?? lastChecked, unwatchableRules: unwatchable,
        ...detailOf(e),
      })
    }
  }

  const advanceTo = processed.length > 0 ? processed[processed.length - 1] : lastChecked
  const remaining = daysBetween(advanceTo, endDate)

  // ── 남은 시간이 있으면 감시 대상이 실제로 조회되는지 확인 ────────────────────
  let invalidTargets: InvalidTarget[] = []
  let verifyIncomplete = false
  let verifyUnchecked = 0
  let verifyError: string | null = null
  try {
    const v = await verifyWatchTargets(oc, targets, () => Date.now() - startedAt > TOTAL_DEADLINE_MS)
    invalidTargets = v.invalid
    verifyIncomplete = v.incomplete
    verifyUnchecked = v.unchecked
  } catch (e) {
    // 확인 실패는 감지 결과를 무르게 하지 않는다 — 사실만 남긴다
    verifyError = e instanceof Error ? e.message : String(e)
  }

  // 처리할 날짜가 있었는데 한 건도 못 했으면 성공이 아니다(초록불 방지)
  const stalled = processed.length === 0 && pending.length > 0
  const warnings: string[] = []
  if (stalled) warnings.push('예정된 날짜를 한 건도 처리하지 못했습니다(시간 상한).')
  if (invalidTargets.length > 0) {
    // 무엇을 고쳐야 하는지 알 수 있게 법령ID·조번호·룰 키까지 남긴다.
    // 건수만 남기면 '35건이 빠졌다'는 사실만 알고 대상은 못 찾는다.
    const detail = invalidTargets
      .map((v) => `${v.lawId}/${v.articleNo}(${v.ruleKeys.join(', ')})`)
      .join(' · ')
    warnings.push(
      `법제처에서 조회되지 않는 감시 대상 ${invalidTargets.length}건 — 법령ID나 조문번호를 확인하세요: ${detail}`,
    )
  }
  if (verifyUnchecked > 0) {
    warnings.push(`감시 대상 ${verifyUnchecked}건은 조회 오류로 확인하지 못했습니다.`)
  }
  if (unwatchable.length > 0) {
    warnings.push(`법령ID·조문번호가 비어 감시 제외된 룰 ${unwatchable.length}건이 있습니다.`)
  }
  if (verifyIncomplete) warnings.push('시간이 모자라 감시 대상 확인을 끝내지 못했습니다.')
  if (verifyError) warnings.push(`감시 대상 확인 실패: ${verifyError}`)
  if (remaining > 0) warnings.push(`아직 ${remaining}일이 밀려 있어 다음 실행이 이어받습니다.`)

  // ok는 '배치가 제 일을 했는가'만 본다. 잘못된 감시 대상은 사람이 고칠 데이터 문제라
  // 경고로 남기고 실패로 만들지 않는다 — 매일 빨간 카드가 뜨면 경고를 무시하게 된다.
  // 대신 화면이 last_error가 있으면 '주의'로 표시해 초록불로 넘어가지 않게 한다.
  const ok = !stalled && !verifyError
  await saveState(supabase, {
    last_checked_date: advanceTo,
    last_run_ok: ok,
    last_error: warnings.length > 0 ? warnings.join(' ') : null,
  })

  return emptyResult({
    ok,
    message:
      `${processed.length}일치를 처리해 ${queuedCount}건을 큐에 넣었습니다` +
      `(바뀐 법령 ${changesSeen}건 중 감시 대상 ${changesMatched}건).` +
      (warnings.length > 0 ? ` ${warnings.join(' ')}` : ''),
    targetCount: targets.length, datesPlanned: pending.length, datesProcessed: processed,
    datesRemaining: remaining, queuedCount, changesSeen, changesMatched,
    lastCheckedDate: advanceTo, invalidTargets, unwatchableRules: unwatchable,
  })
}
