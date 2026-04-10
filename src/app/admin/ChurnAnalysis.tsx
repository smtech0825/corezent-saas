'use client'

/**
 * @컴포넌트: ChurnAnalysis
 * @설명: 구독 취소 사유 분석 — 가로 막대 차트 + Other 코멘트 리스트
 *        This Month / All Time 필터 토글
 */

import { useState, useMemo } from 'react'
import { BarChart3, MessageSquare } from 'lucide-react'

export interface CancelEntry {
  reason: string
  email: string
  updatedAt: string
}

interface Props {
  entries: CancelEntry[]
}

const OTHER_PREFIX = 'Other / Prefer not to say.'

/** reason에서 카테고리명 추출 — "Other / Prefer not to say. — xxx" → "Other" */
function categorize(reason: string): string {
  if (reason.startsWith(OTHER_PREFIX)) return 'Other'
  return reason.replace(/\.$/, '')
}

/** "Other / Prefer not to say. — some text" → "some text", 없으면 null */
function extractOtherText(reason: string): string | null {
  if (!reason.startsWith(OTHER_PREFIX)) return null
  const sep = ' — '
  const idx = reason.indexOf(sep)
  if (idx === -1) return null
  const text = reason.slice(idx + sep.length).trim()
  return text || null
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// 막대 색상 (카테고리 순서에 따라 할당)
const BAR_COLORS = [
  'bg-[#38BDF8]',
  'bg-violet-400',
  'bg-amber-400',
  'bg-emerald-400',
  'bg-rose-400',
  'bg-cyan-400',
]

export default function ChurnAnalysis({ entries }: Props) {
  const [period, setPeriod] = useState<'month' | 'all'>('all')

  // 이번 달 시작일 (UTC)
  const monthStart = useMemo(() => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  }, [])

  // 필터링된 항목
  const filtered = useMemo(() => {
    if (period === 'all') return entries
    return entries.filter((e) => e.updatedAt >= monthStart)
  }, [entries, period, monthStart])

  // ── 막대 차트 데이터 ────────────────────────────────────────────
  const chartData = useMemo(() => {
    const counts = new Map<string, number>()
    filtered.forEach((e) => {
      const cat = categorize(e.reason)
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    })
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const max = sorted[0]?.[1] ?? 1
    return sorted.map(([label, count], i) => ({
      label,
      count,
      pct: Math.round((count / max) * 100),
      color: BAR_COLORS[i % BAR_COLORS.length],
    }))
  }, [filtered])

  // ── Other 코멘트 리스트 (시간 역순) ─────────────────────────────
  const otherComments = useMemo(() => {
    return filtered
      .map((e) => ({
        email: e.email,
        date: e.updatedAt,
        text: extractOtherText(e.reason),
      }))
      .filter((c): c is { email: string; date: string; text: string } => c.text !== null)
  }, [filtered])

  return (
    <section className="space-y-4">
      {/* 헤더 + 필터 토글 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Churn Analysis</h2>
        <div className="flex items-center gap-1 bg-[#0B1120] border border-[#1E293B] rounded-lg p-0.5">
          <button
            onClick={() => setPeriod('month')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              period === 'month'
                ? 'bg-[#38BDF8] text-[#0B1120] font-semibold'
                : 'text-[#475569] hover:text-white'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              period === 'all'
                ? 'bg-[#38BDF8] text-[#0B1120] font-semibold'
                : 'text-[#475569] hover:text-white'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl py-12 text-center text-sm text-[#475569]">
          No cancellation data {period === 'month' ? 'this month' : 'yet'}.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* ── 왼쪽: 가로 막대 차트 ── */}
          <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={15} className="text-[#94A3B8]" />
              <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Top Cancellation Reasons
              </h3>
              <span className="text-[10px] text-[#475569] ml-auto">{filtered.length} total</span>
            </div>

            {chartData.length === 0 ? (
              <p className="text-sm text-[#475569] text-center py-6">No data.</p>
            ) : (
              <div className="space-y-3">
                {chartData.map((d) => (
                  <div key={d.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#94A3B8] truncate max-w-[70%]">{d.label}</span>
                      <span className="text-xs font-semibold text-white tabular-nums">{d.count}</span>
                    </div>
                    <div className="h-2.5 bg-[#1E293B] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${d.color}`}
                        style={{ width: `${Math.max(d.pct, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 오른쪽: Other 코멘트 리스트 ── */}
          <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={15} className="text-[#94A3B8]" />
              <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Recent Feedback
              </h3>
              <span className="text-[10px] text-[#475569] ml-auto">{otherComments.length} comments</span>
            </div>

            {otherComments.length === 0 ? (
              <p className="text-sm text-[#475569] text-center py-6 flex-1 flex items-center justify-center">
                No written feedback {period === 'month' ? 'this month' : 'yet'}.
              </p>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[320px] space-y-2.5 pr-1">
                {otherComments.map((c, i) => (
                  <div
                    key={i}
                    className="bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#94A3B8] truncate max-w-[60%]">{c.email}</span>
                      <span className="text-[10px] text-[#475569] shrink-0">{fmtDate(c.date)}</span>
                    </div>
                    <p className="text-sm text-[#F1F5F9] leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
