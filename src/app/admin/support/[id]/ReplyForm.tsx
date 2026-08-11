'use client'

/**
 * @컴포넌트: ReplyForm
 * @설명: 지원 티켓 답변 폼 — 답변 입력 및 상태 변경.
 *        결과를 예외가 아니라 반환값으로 받는다. 운영 환경에서는 서버 예외 문구가 일반
 *        문구로 바뀌어, "답변은 이미 저장됐다"는 사실이 화면에 전달되지 않기 때문이다.
 */

import { useState } from 'react'
import { Send, AlertTriangle, CheckCircle2 } from 'lucide-react'

/**
 * @타입: ReplyResult
 * @설명: 답변 전송 결과 세 가지.
 *        ok = 전부 성공 / sent_but_status_failed = 답변은 전송됐고 상태 표시만 실패(재전송 금지)
 *        / save_failed = 답변 저장 자체가 실패(다시 시도해도 안전)
 */
export type ReplyResult =
  | { status: 'ok' }
  | { status: 'sent_but_status_failed'; reason: string }
  | { status: 'save_failed'; reason: string }

interface Props {
  onSubmit: (message: string, close: boolean) => Promise<ReplyResult>
}

export default function ReplyForm({ onSubmit }: Props) {
  const [message, setMessage] = useState('')
  const [closing, setClosing] = useState(false)
  const [loading, setLoading] = useState(false)
  // 이미 고객에게 나간 답변을 다시 보내지 못하게 잠그는 표시
  const [alreadySent, setAlreadySent] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'sent' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || alreadySent) return
    setLoading(true)
    setNotice(null)
    try {
      const result = await onSubmit(message, closing)

      if (result.status === 'ok') {
        // 성공했을 때만 입력을 비운다 — 실패했는데 지우면 작성한 답변이 날아간다.
        setMessage('')
        setClosing(false)
        return
      }

      if (result.status === 'sent_but_status_failed') {
        // 답변은 이미 고객에게 나갔다. 입력을 비우지 않고 폼을 잠가 재전송을 막는다.
        setAlreadySent(true)
        setNotice({
          kind: 'sent',
          text: `답변은 이미 전송되었습니다. 다시 보내지 마세요 — 다시 보내면 고객에게 같은 답변이 두 번 갑니다. 티켓 상태 표시만 실패했습니다(${result.reason}). 위의 "티켓 닫기" 버튼이나 고객지원 목록에서 상태를 확인해 주세요.`,
        })
        return
      }

      // 저장 자체가 실패 — 아직 아무것도 나가지 않았으므로 그대로 다시 시도해도 안전하다.
      setNotice({
        kind: 'error',
        text: `답변을 저장하지 못했습니다(${result.reason}). 작성한 내용은 그대로 두었으니 다시 시도해 주세요.`,
      })
    } catch (err) {
      // 권한 확인 실패·네트워크 오류 등 — 저장 전에 막힌 경우라 재시도해도 안전하다.
      console.error('[ReplyForm] 답변 전송 실패:', err)
      setNotice({
        kind: 'error',
        text: '답변을 보내지 못했습니다. 로그인 상태를 확인하고 다시 시도해 주세요. 작성한 내용은 그대로 두었습니다.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-rule bg-paper-raised rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">답변</h3>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs leading-relaxed ${
            notice.kind === 'sent'
              ? 'border-caution/20 bg-caution-soft text-caution'
              : 'border-danger/20 bg-danger-soft text-danger'
          }`}
        >
          {notice.kind === 'sent'
            ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="답변을 입력하세요..."
        rows={4}
        disabled={alreadySent}
        className="w-full bg-paper border border-rule rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark resize-none disabled:opacity-60"
        required
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer select-none">
          <input
            type="checkbox"
            checked={closing}
            onChange={(e) => setClosing(e.target.checked)}
            disabled={alreadySent}
            className="rounded border-rule bg-paper accent-mark"
          />
          답변 후 티켓 닫기
        </label>
        <button
          type="submit"
          disabled={loading || alreadySent || !message.trim()}
          className="flex items-center gap-2 bg-mark text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={14} />
          {alreadySent ? '전송 완료' : loading ? '보내는 중…' : '답변 보내기'}
        </button>
      </div>
    </form>
  )
}
