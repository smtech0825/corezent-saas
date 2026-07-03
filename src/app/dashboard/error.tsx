'use client'

/**
 * @파일: dashboard/error.tsx
 * @설명: 대시보드 에러 바운더리 — 서버 에러 시 사용자 친화적 화면 표시
 */

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard] error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-caution-soft border border-caution/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={24} className="text-caution" />
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">문제가 발생했습니다</h2>
        <p className="text-sm text-ink-soft mb-4 leading-relaxed">
          이 페이지를 불러오는 중 예상치 못한 오류가 발생했습니다.
        </p>
        <pre className="text-xs text-danger bg-danger-soft border border-danger/20 rounded-lg px-4 py-3 mb-6 text-left whitespace-pre-wrap break-all max-h-40 overflow-auto">
          {error.message}
          {error.digest && `\nDigest: ${error.digest}`}
        </pre>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-mark text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:brightness-95 transition-colors"
        >
          <RefreshCw size={14} />
          다시 시도
        </button>
      </div>
    </div>
  )
}
