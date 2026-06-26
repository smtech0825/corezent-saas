'use client'

/**
 * @컴포넌트: ReferralCopyButton
 * @설명: 추천 링크를 클립보드로 복사하는 버튼 (표시 전용 — DB 쓰기 없음)
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function ReferralCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  /** 추천 링크를 클립보드에 복사하고 2초간 완료 상태를 표시한다. */
  async function handleCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드 권한 거부·비보안 컨텍스트 등 — 조용히 무시(사용자가 수동 복사 가능)
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="추천 링크 복사"
      className="shrink-0 inline-flex items-center gap-1.5 bg-accent text-bg font-semibold px-4 rounded-lg text-sm hover:bg-accent-dark transition-colors"
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? '복사됨' : '복사'}
    </button>
  )
}
