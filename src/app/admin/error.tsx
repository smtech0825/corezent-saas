'use client'

/**
 * @파일: admin/error.tsx
 * @설명: 관리자 페이지 에러 바운더리
 */

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[admin] error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-caution-soft border border-caution/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={24} className="text-caution" />
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">문제가 발생했습니다</h2>
        <pre className="text-xs text-danger bg-danger-soft border border-danger/10 rounded-lg px-4 py-3 mb-6 text-left whitespace-pre-wrap break-all max-h-40 overflow-auto">
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
