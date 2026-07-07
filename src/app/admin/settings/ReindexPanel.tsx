'use client'

/**
 * @컴포넌트: ReindexPanel
 * @설명: 관리자 색인 재요청 도구. 버튼 클릭 시 sitemap 전체 URL을 IndexNow·Google Indexing에 제출한다.
 *        - POST /api/admin/seo/reindex 호출 → 채널별 결과를 인라인으로 표시
 *        - 상품 추가/대량 수정 후 검색엔진에 즉시 알리고 싶을 때 사용
 */

import { useState } from 'react'
import { Loader2, RefreshCw, Check, AlertCircle } from 'lucide-react'

/** 채널별 제출 결과 (API 응답과 동일 형태) */
type SubmitResult = {
  engine: 'indexnow' | 'google'
  ok: boolean
  submitted: number
  detail: string
}

const ENGINE_LABEL: Record<SubmitResult['engine'], string> = {
  indexnow: 'IndexNow (Bing·Naver 등)',
  google: 'Google Indexing API',
}

export default function ReindexPanel() {
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [results, setResults] = useState<SubmitResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * @함수명: runReindex
   * @설명: 색인 재요청 API를 호출하고 결과를 상태에 반영한다.
   */
  async function runReindex() {
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const res = await fetch('/api/admin/seo/reindex', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? '색인 재요청에 실패했습니다.')
      setCount(data.count ?? null)
      setResults(data.results ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '색인 재요청에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-rule bg-paper-raised rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-rule">
        <h2 className="text-sm font-semibold text-ink">검색엔진 색인 재요청</h2>
        <p className="text-xs text-ink-faint mt-0.5">
          sitemap의 모든 공개 URL을 IndexNow·Google Indexing에 즉시 제출합니다. 상품을 추가·수정한 뒤 사용하세요.
        </p>
      </div>

      <div className="p-6 space-y-4">
        <button
          onClick={runReindex}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-mark hover:brightness-95 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {loading ? '제출 중…' : '전체 재색인 요청'}
        </button>

        {error && (
          <div className="flex items-start gap-2 bg-danger-soft border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {results && (
          <div className="space-y-2">
            {count !== null && (
              <p className="text-xs text-ink-faint">대상 URL {count}개</p>
            )}
            {results.map((r) => (
              <div
                key={r.engine}
                className="flex items-center justify-between gap-3 border border-rule rounded-xl px-4 py-2.5"
              >
                <span className="text-sm text-ink">{ENGINE_LABEL[r.engine]}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    r.ok ? 'text-success' : 'text-danger'
                  }`}
                >
                  {r.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                  {r.submitted}건 · {r.detail}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
