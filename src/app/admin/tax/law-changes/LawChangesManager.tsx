'use client'

/**
 * @컴포넌트: LawChangesManager
 * @설명: 감지된 법령 개정 목록과 배치 실행 상태를 보여주고, 처리 상태를 바꾼다.
 *        룰은 자동으로 고치지 않는다 — 이 화면은 '무엇이 바뀌었는지'를 알리는 데까지다.
 *
 *        ⚠️ 화면에 반드시 남겨야 하는 사실: 법제처 조문번호는 조 단위(6자리)라
 *        항을 구분하지 못한다. "제95조가 바뀌었다"까지만 알 수 있고 어느 항인지는
 *        사람이 원문을 대조해야 한다. 이 한계를 감추면 관리자가 잘못 판단한다.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Loader2, ScrollText } from 'lucide-react'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/common/EmptyState'
import { TAX_TYPE_LABELS } from '@/lib/tax/labels'
import type { TaxLawChangeQueueItem, TaxLawWatchState } from '@/lib/tax/types'
import { setLawChangeStatus, type LawChangeStatus } from './actions'

/** 감지 한 건 + 화면이 쓸 부가 정보 */
export interface LawChangeRow {
  item: TaxLawChangeQueueItem
  matchedRules: {
    ruleKey: string
    confirmedCount: number
    proposedCount: number
    taxType: string | null
    lawArticle: string | null
  }[]
  oldAndNewUrl: string | null
}

/** 처리 상태 라벨과 색 */
const STATUS_META: Record<LawChangeStatus, { label: string; cls: string }> = {
  pending: { label: '미확인', cls: 'bg-caution-soft text-caution' },
  reviewed: { label: '확인함', cls: 'bg-ok-soft text-ok' },
  ignored: { label: '해당 없음', cls: 'bg-paper-shade text-ink-soft' },
}

/** 날짜·시각 표기 (한국 기준) */
function when(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

/** 6자리 조번호를 사람이 읽는 형태로 — 009500 → 제95조, 001302 → 제13조의2 */
function articleLabel(raw: string | null): string {
  if (!raw || raw.length !== 6) return raw ?? '—'
  const main = Number(raw.slice(0, 4))
  const branch = Number(raw.slice(4, 6))
  if (Number.isNaN(main)) return raw
  return branch > 0 ? `제${main}조의${branch}` : `제${main}조`
}

export default function LawChangesManager({
  rows,
  watchState,
}: {
  rows: LawChangeRow[]
  watchState: TaxLawWatchState | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  /** 처리 상태 변경 */
  function changeStatus(id: string, status: LawChangeStatus) {
    setError(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await setLawChangeStatus(id, status)
      setBusyId(null)
      if (result.status === 'ok') router.refresh()
      else setError(result.reason)
    })
  }

  const runOk = watchState?.last_run_ok
  const neverRan = !watchState || watchState.last_run_at === null

  return (
    <div className="space-y-5">
      {/* ── 배치 실행 상태 — 조용히 죽었는지 여기서 드러나야 한다 ────────────── */}
      <div
        className={`border rounded-lg p-5 ${
          neverRan
            ? 'bg-paper-raised border-rule'
            : runOk
              ? 'bg-paper-raised border-rule'
              : 'bg-caution-soft border-caution'
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
              {neverRan ? '아직 한 번도 실행되지 않았습니다' : runOk ? '정상' : '마지막 실행이 실패했습니다'}
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
                  {rows.filter((r) => r.item.status === 'pending').length}건
                </dd>
              </div>
            </dl>
            {watchState?.last_error && (
              <p className="mt-3 text-sm text-caution leading-relaxed break-words">
                {watchState.last_error}
              </p>
            )}
            {neverRan && (
              <p className="mt-2 text-xs text-ink-soft leading-relaxed">
                Vercel Cron이 하루 한 번 부릅니다. 환경변수(CRON_SECRET·LAW_API_OC)가 설정되지 않으면
                실행되지 않고 이 칸도 비어 있습니다.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 조문번호의 한계 — 감추면 관리자가 잘못 판단한다 ─────────────────── */}
      <div className="bg-paper-raised border border-rule rounded-lg p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink mb-1.5">
          <ScrollText size={16} className="text-pen" aria-hidden="true" />
          읽는 방법 — 조문번호는 조 단위입니다
        </h2>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-soft leading-relaxed">
          <li>
            법제처 조문번호는 6자리(조 4자리 + 가지 2자리)라 <b>항을 구분하지 못합니다.</b>{' '}
            &lsquo;제95조가 바뀌었다&rsquo;까지만 알 수 있고, 어느 항이 어떻게 바뀌었는지는
            신구법 대조로 사람이 확인해야 합니다.
          </li>
          <li>
            그래서 한 건에 여러 룰이 함께 걸립니다 — 소득세법 제95조 하나에 장기보유특별공제
            일반표·1주택표·한도·보유기간 규정이 모두 매달려 있습니다. 걸린 룰이 전부 바뀐다는
            뜻이 아닙니다.
          </li>
          <li>
            같은 조문에 확정법과 개정안 룰이 함께 있을 수 있어 아래에 나눠 표시합니다.
            개정안 룰은 국회 통과 전이므로 이번 개정과 무관할 수 있습니다.
          </li>
          <li>이 화면은 룰을 고치지 않습니다. 값 수정은 룰 편집 화면에서 직접 합니다.</li>
        </ul>
      </div>

      {error && (
        <div className="bg-caution-soft border border-caution rounded-lg p-4" role="alert">
          <p className="text-sm text-caution">{error}</p>
        </div>
      )}

      {/* ── 감지 목록 ──────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="bg-paper-raised border border-rule rounded-lg">
          <EmptyState
            message="감지된 법령 개정이 없습니다."
            description="감시 배치가 매일 돌면서 등록된 룰의 근거 조문이 바뀌었는지 확인합니다."
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ item, matchedRules, oldAndNewUrl }) => {
            const meta = STATUS_META[item.status]
            const busy = isPending && busyId === item.id
            return (
              <li key={item.id} className="bg-paper-raised border border-rule rounded-lg p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif font-bold text-ink">
                        {item.law_name} {articleLabel(item.article_no)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                      {item.change_type && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
                          {item.change_type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-soft mt-1.5">
                      시행일 <b className="font-mono text-ink">{item.effective_date ?? '미확인'}</b>
                      <span className="mx-2 text-rule">|</span>
                      감지 {when(item.detected_at)}
                      <span className="mx-2 text-rule">|</span>
                      법령ID <span className="font-mono">{item.law_id ?? '—'}</span>
                      <span className="mx-2 text-rule">|</span>
                      조번호 <span className="font-mono">{item.article_no ?? '—'}</span>
                    </p>
                  </div>
                  {oldAndNewUrl && (
                    <a
                      href={oldAndNewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-pen underline underline-offset-2 hover:text-pen-dark shrink-0"
                    >
                      개정 전후 대조(신구법)
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </div>

                {/* 걸린 룰 — 확정법·개정안을 나눠 보여준다 */}
                <div className="mt-3 pt-3 border-t border-rule">
                  <p className="text-xs text-ink-soft mb-1.5">
                    이 조문에 걸린 룰 {matchedRules.length}건 — 전부 바뀐다는 뜻은 아닙니다
                  </p>
                  {matchedRules.length === 0 ? (
                    <p className="text-xs text-ink-faint">
                      걸린 룰이 없습니다(감지 이후 룰이 삭제됐을 수 있습니다).
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {matchedRules.map((r) => (
                        <li
                          key={r.ruleKey}
                          className="px-2 py-1 rounded bg-paper-shade text-[11px] text-ink-soft"
                        >
                          {r.taxType && (
                            <span className="font-semibold text-ink">
                              {(TAX_TYPE_LABELS as Record<string, string>)[r.taxType] ?? r.taxType}{' '}
                            </span>
                          )}
                          <span className="font-mono">{r.ruleKey}</span>
                          {r.confirmedCount > 0 && (
                            <span className="ml-1.5 text-ok">확정 {r.confirmedCount}</span>
                          )}
                          {r.proposedCount > 0 && (
                            <span className="ml-1.5 text-caution">개정안 {r.proposedCount}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 처리 상태 변경 */}
                <div className="mt-3 pt-3 border-t border-rule flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-soft mr-1">처리 상태</span>
                  {(['pending', 'reviewed', 'ignored'] as LawChangeStatus[]).map((s) => (
                    <Button
                      key={s}
                      variant={item.status === s ? 'primary' : 'outline'}
                      size="sm"
                      disabled={busy || item.status === s}
                      onClick={() => changeStatus(item.id, s)}
                    >
                      {busy && <Loader2 size={13} className="animate-spin mr-1" aria-hidden="true" />}
                      {STATUS_META[s].label}
                    </Button>
                  ))}
                  {item.reviewed_at && (
                    <span className="text-xs text-ink-faint ml-1">검토 {when(item.reviewed_at)}</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
