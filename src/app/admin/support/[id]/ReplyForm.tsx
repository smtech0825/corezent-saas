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
      // 성공했을 때만 입력을 비운다 — 실패했는데 지우면 작성한 답변이 날아간다.
      setMessage('')
      setClosing(false)
    } catch (err) {
      console.error('[ReplyForm] 답변 전송 실패:', err)
      alert('답변 전송에 실패했습니다. 로그인 상태를 확인하고 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-rule bg-paper-raised rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">답변</h3>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="답변을 입력하세요..."
        rows={4}
        className="w-full bg-paper border border-rule rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark resize-none"
        required
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer select-none">
          <input
            type="checkbox"
            checked={closing}
            onChange={(e) => setClosing(e.target.checked)}
            className="rounded border-rule bg-paper accent-mark"
          />
          답변 후 티켓 닫기
        </label>
        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="flex items-center gap-2 bg-mark text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={14} />
          {loading ? '보내는 중…' : '답변 보내기'}
        </button>
      </div>
    </form>
  )
}
