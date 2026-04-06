'use client'

/**
 * @컴포넌트: LicenseCopyButton
 * @설명: 라이선스 키 클립보드 복사 버튼
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function LicenseCopyButton({ serialKey }: { serialKey: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(serialKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy license key"
      className="p-1 text-[#475569] hover:text-[#38BDF8] transition-colors shrink-0"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  )
}
