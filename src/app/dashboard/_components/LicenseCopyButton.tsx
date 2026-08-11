'use client'

/**
 * @컴포넌트: LicenseCopyButton
 * @설명: 라이선스 키 클립보드 복사 버튼
 */

import { useState, useRef, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'

export default function LicenseCopyButton({ serialKey }: { serialKey: string }) {
  const [copied, setCopied] = useState(false)
  // "복사됨" 표시를 되돌리는 예약. 다시 누르면 이전 예약을 취소하고, 화면을 떠날 때도 정리한다.
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (resetRef.current) clearTimeout(resetRef.current) }, [])

  async function handleCopy() {
    await navigator.clipboard.writeText(serialKey)
    setCopied(true)
    if (resetRef.current) clearTimeout(resetRef.current)
    resetRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="라이선스 키 복사"
      className="p-1 text-ink-faint hover:text-mark transition-colors shrink-0"
    >
      {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
    </button>
  )
}
