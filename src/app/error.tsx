'use client'

/**
 * @파일: app/error.tsx
 * @설명: 전역 에러 바운더리 — 페이지 렌더링 중 예외 발생 시 한국어 안내 화면 표시
 */

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={24} className="text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">문제가 발생했습니다</h2>
        <p className="text-sm text-[#94A3B8] mb-4 leading-relaxed">
          페이지를 불러오는 중 예상치 못한 오류가 발생했습니다.
        </p>
        <pre className="text-xs text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg px-4 py-3 mb-6 text-left whitespace-pre-wrap break-all max-h-40 overflow-auto">
          {error.message}
          {error.digest && `\nDigest: ${error.digest}`}
        </pre>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-[#0ea5e9] transition-colors"
          >
            <RefreshCw size={14} />
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-[#1E293B] text-[#F1F5F9] font-medium text-sm px-5 py-2.5 rounded-xl hover:border-[#38BDF8]/40 transition-colors"
          >
            <Home size={14} />
            홈으로 가기
          </Link>
        </div>
      </div>
    </div>
  )
}
