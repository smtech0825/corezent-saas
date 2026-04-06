'use client'

/**
 * @컴포넌트: ReplyForm
 * @설명: 지원 티켓 답변 폼 — 답변 입력 및 상태 변경
 */

import { useState } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSubmit: (message: string, close: boolean) => Promise<void>
}

export default function ReplyForm({ onSubmit }: Props) {
  const [message, setMessage] = useState('')
  const [closing, setClosing] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setLoading(true)
    try {
      await onSubmit(message, closing)
      setMessage('')
      setClosing(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-white">Reply</h3>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your reply..."
        rows={4}
        className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-3 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-amber-500/50 resize-none"
        required
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-[#94A3B8] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={closing}
            onChange={(e) => setClosing(e.target.checked)}
            className="rounded border-[#1E293B] bg-[#0B1120] accent-amber-500"
          />
          Close ticket after reply
        </label>
        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="flex items-center gap-2 bg-amber-500 text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={14} />
          {loading ? 'Sending…' : 'Send Reply'}
        </button>
      </div>
    </form>
  )
}
