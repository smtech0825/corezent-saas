/**
 * @컴포넌트: WatchStateCard
 * @설명: 감시 배치의 실행 상태 카드. 배치가 조용히 죽으면 큐가 비어 있는 것과
 *        구분되지 않으므로, 마지막 실행 시각·성공 여부·처리 완료일을 여기서 밝힌다.
 *        마지막 실행이 성공이어도 오래됐으면 '멈춘 것'으로 본다 — 성공 여부만 보면
 *        Cron이 죽었을 때 초록불이 그대로 남는다.
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Info, Loader2, SkipForward } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { TaxLawWatchState } from '@/lib/tax/types'
import { skipStuckWatchDate } from './actions'

/** 마지막 실행이 이 시간을 넘으면 '멈춘 것'으로 본다 — 하루 1회 실행 + 여유 */
const STALE_AFTER_HOURS = 36

/** 날짜·시각 표기 (한국 기준) */
function when(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export default function WatchStateCard({
  watchState,
  pendingCount,
  unwatchable,
}: {
  watchState: TaxLawWatchState | null
  /** 화면에 실린 미확인 건수 */
  pendingCount: number
  /** 법령ID·조문번호가 비어 감시 자체가 안 되는 룰 */
  unwatchable: { ruleKey: string; lawName: string; reason: string }[]
}) {
  const neverRan = !watchState || watchState.last_run_at === null
  const stale =
    !neverRan &&
    Date.now() - new Date(watchState!.last_run_at!).getTime() > STALE_AFTER_HOURS * 3_600_000
  const failed = !neverRan && watchState?.last_run_ok === false
  // 실행은 성공했어도 경고가 남아 있으면 초록불로 넘기지 않는다 — 잘못된 법령ID처럼
  // 사람이 고쳐야 할 문제가 묻히기 때문이다
  const warn = !neverRan && !failed && !stale && !!watchState?.last_error
  const runOk = !neverRan && !failed && !stale && !warn

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [skipError, setSkipError] = useState<string | null>(null)

  /** 막힌 날짜 건너뛰기 — 사람이 의식적으로 누를 때만 동작한다 */
  function skipDate() {
    setSkipError(null)
    startTransition(async () => {
      const result = await skipStuckWatchDate()
      if (result.status === 'ok') router.refresh()
      else setSkipError(result.reason)
    })
  }

  return (
    <div
      className={`border rounded-lg p-5 ${
        neverRan || runOk ? 'bg-paper-raised border-rule' : 'bg-caution-soft border-caution'
      }`}
    >
      <div className="flex items-start gap-2">
        {neverRan ? (
          <Info size={18} className="text-ink-soft mt-0.5 shrink-0" aria-hidden="true" />
        ) : runOk ? (
          <CheckCircle2 size={18} className="text-ok mt-0.5 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle size={18} className="text-caution mt-0.5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <h2 className="font-serif font-bold text-ink">
            감시 배치 —{' '}
            {neverRan
              ? '아직 한 번도 실행되지 않았습니다'
              : stale
                ? `${STALE_AFTER_HOURS}시간 넘게 실행되지 않았습니다`
                : failed
                  ? '마지막 실행이 실패했습니다'
                  : warn
                    ? '돌긴 했지만 확인할 것이 있습니다'
                    : '정상'}
          </h2>
          <dl className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-soft shrink-0">마지막 실행</dt>
              <dd className="font-mono text-ink">{when(watchState?.last_run_at ?? null)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-soft shrink-0">처리 완료일</dt>
              <dd className="font-mono text-ink">{watchState?.last_checked_date ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-soft shrink-0">미확인</dt>
              <dd className="font-mono text-ink">
                {pendingCount}건
              </dd>
            </div>
          </dl>
          {watchState?.last_error && (
            <p className="mt-3 text-sm text-caution leading-relaxed break-words">
              {watchState.last_error}
            </p>
          )}
          {stale && (
            <p className="mt-3 text-sm text-caution leading-relaxed">
              마지막 실행이 성공이었더라도 그 뒤로 돌지 않았습니다. Cron 설정·환경변수·배포
              상태를 확인하세요 — 감지가 멈춘 동안의 개정은 쌓이지 않습니다.
            </p>
          )}
          {neverRan && (
            <p className="mt-2 text-xs text-ink-soft leading-relaxed">
              Vercel Cron이 하루 한 번 부릅니다. 환경변수(CRON_SECRET·LAW_API_OC)가 설정되지 않으면
              실행되지 않고 이 칸도 비어 있습니다.
            </p>
          )}
          {failed && watchState?.last_checked_date && (
            <div className="mt-3 pt-3 border-t border-rule">
              <p className="text-xs text-ink-soft leading-relaxed mb-2">
                같은 날짜에서 계속 실패하면 그 뒤 날짜를 영영 보지 못합니다. 원인을 고칠 수
                없을 때만 아래로 한 칸 밀어 교착을 푸세요 —{' '}
                <b>건너뛴 날짜의 개정은 감지되지 않습니다.</b>
              </p>
              <Button variant="outline" size="sm" disabled={isPending} onClick={skipDate}>
                {isPending ? (
                  <Loader2 size={13} className="animate-spin mr-1" aria-hidden="true" />
                ) : (
                  <SkipForward size={13} className="mr-1" aria-hidden="true" />
                )}
                막힌 날짜 하루 건너뛰기
              </Button>
              {skipError && <p className="mt-2 text-sm text-caution">{skipError}</p>}
            </div>
          )}
          {unwatchable.length > 0 && (
            <div className="mt-3 pt-3 border-t border-rule">
              <p className="text-sm font-semibold text-ink mb-1">
                감시 제외 룰 {unwatchable.length}건 — 법령ID·조문번호가 비어 있습니다
              </p>
              <p className="text-xs text-ink-soft leading-relaxed mb-1.5">
                이 룰들은 근거 조문이 바뀌어도 감지되지 않습니다. 룰 편집 화면에서 법령ID와
                6자리 조문번호를 채우면 감시에 들어옵니다.
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {unwatchable.map((u) => (
                  <li
                    key={u.ruleKey}
                    className="px-2 py-1 rounded bg-paper-shade text-[11px] text-ink-soft"
                  >
                    <span className="font-mono">{u.ruleKey}</span>
                    <span className="ml-1.5 text-caution">{u.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
