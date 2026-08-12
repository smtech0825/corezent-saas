/**
 * @컴포넌트: ErrorSummary
 * @설명: 같은 오류 묶어 보여주기 — "○○ · N회 (마지막 시각)" 형태의 접힌 줄로 요약하고,
 *        펼치면(details) 한글 설명·영어 원문 전문·개별 건 전부를 보여준다.
 *        묶는 기준: 종류+이벤트+오류 원문 '완전 일치'(2026-08-12 실측 — 같은 오류 39건이
 *        글자까지 동일했고, 앞부분 기준은 서로 다른 오류를 합칠 위험이 있어 전문 일치를 택함).
 *        서버 컴포넌트 — 데이터는 page가 조회해 넘긴다(읽기 전용, 원본 행은 그대로 표에 남는다).
 */

import { ChevronDown } from 'lucide-react'
import { explainError } from './error-explanations'

export interface ErrorRow {
  id: string
  kind: string
  event: string | null
  target: string | null
  error: string
  created_at: string
}

interface Props {
  /** 필터가 적용된 실패 로그(최근 SUMMARY_LIMIT건) */
  rows: ErrorRow[]
  /** 요약 표본 상한(도달 시 "최근 N건 기준" 안내) */
  limit: number
  /** 시각 표기 함수(page와 동일 형식 공유) */
  fmt: (d: string) => string
}

/** 묶음 하나 — 완전히 같은 (종류·이벤트·오류 원문) 행들의 모임 */
interface Group {
  kind: string
  event: string | null
  error: string
  count: number
  lastAt: string
  rows: ErrorRow[]
}

export default function ErrorSummary({ rows, limit, fmt }: Props) {
  if (rows.length === 0) return null

  // 전문 완전 일치로 묶는다 — 키에 구분자가 섞여도 안전하게 JSON 배열 키 사용
  const map = new Map<string, Group>()
  for (const r of rows) {
    const key = JSON.stringify([r.kind, r.event, r.error])
    const g = map.get(key)
    if (g) {
      g.count += 1
      if (r.created_at > g.lastAt) g.lastAt = r.created_at
      g.rows.push(r)
    } else {
      map.set(key, { kind: r.kind, event: r.event, error: r.error, count: 1, lastAt: r.created_at, rows: [r] })
    }
  }
  const groups = [...map.values()].sort((a, b) => b.count - a.count)

  return (
    <div className="border border-rule bg-paper-raised rounded-card overflow-hidden">
      <div className="px-5 py-2.5 border-b border-rule flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-ink-soft">같은 오류 묶음 · {groups.length}종</span>
        {rows.length >= limit && (
          <span className="text-xs text-ink-faint">최근 {limit}건 기준</span>
        )}
      </div>
      <div className="divide-y divide-rule">
        {groups.map((g) => {
          const explain = explainError(g.error)
          return (
            <details key={JSON.stringify([g.kind, g.event, g.error])} className="group">
              <summary className="flex items-center gap-2.5 px-5 py-3 cursor-pointer select-none hover:bg-paper-shade transition-colors list-none">
                <ChevronDown size={14} className="text-ink-faint shrink-0 transition-transform group-open:rotate-180" />
                <span className="text-sm text-ink min-w-0 truncate">
                  {g.event ?? (g.kind === 'email' ? '이메일' : '웹훅')} 오류
                </span>
                <span className="text-sm font-semibold text-danger shrink-0 tabular-nums">{g.count}회</span>
                <span className="text-xs text-ink-faint shrink-0">(마지막 {fmt(g.lastAt)})</span>
              </summary>
              <div className="px-5 pb-4 pt-1 space-y-3">
                {/* 한글 설명 — 대응표에 있는 오류만. 원문에 '덧붙이는' 설명이다 */}
                {explain && (
                  <p className="text-sm text-ink-soft leading-relaxed">{explain}</p>
                )}
                {/* 영어 원문 전문 — 지우거나 줄이지 않는다(원인 추적용) */}
                <p className="font-mono text-xs text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2 break-all">
                  {g.error}
                </p>
                {/* 개별 건 전부 — 묶는다고 정보가 사라지면 안 된다 */}
                <ul className="space-y-1">
                  {g.rows.map((r) => (
                    <li key={r.id} className="flex items-baseline gap-3 text-xs">
                      <span className="text-ink-faint whitespace-nowrap tabular-nums">{fmt(r.created_at)}</span>
                      <span className="text-ink-soft truncate">{r.target ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
