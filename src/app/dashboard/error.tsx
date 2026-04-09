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
        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={24} className="text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-[#94A3B8] mb-6 leading-relaxed">
          An unexpected error occurred while loading this page.
          Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-[#0ea5e9] transition-colors"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    </div>
  )
}
