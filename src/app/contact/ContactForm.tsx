'use client'

/**
 * @컴포넌트: ContactForm
 * @설명: 비회원 문의 폼 — 제목, 이메일, 내용, 첨부파일(드래그&드롭)
 *        Honeypot 스팸 방지, 5MB 첨부 제한, Toast 알림.
 *        첨부 칸은 공용 부품 AttachmentField(여기 있던 것을 추출)로 그린다 — 동작 동일.
 */

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { useToast } from '@/components/common/Toast'
import AttachmentField from '@/components/common/AttachmentField'

export default function ContactForm() {
  const { showToast } = useToast()

  const [subject, setSubject] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)

  // 제출
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending) return

    if (!subject.trim() || !email.trim() || !message.trim()) {
      showToast('error', '필수 항목을 모두 입력해 주세요.')
      return
    }

    setSending(true)
    try {
      const body = new FormData()
      body.append('subject', subject.trim())
      body.append('email', email.trim())
      body.append('message', message.trim())
      // Honeypot 필드 — 값이 비어있어야 정상
      body.append('website', (e.currentTarget.elements.namedItem('website') as HTMLInputElement)?.value ?? '')
      if (file) body.append('attachment', file)

      const res = await fetch('/api/contact', { method: 'POST', body })
      const data = await res.json()

      if (!res.ok) {
        showToast('error', data.error ?? '전송에 실패했습니다. 다시 시도해 주세요.')
        return
      }

      showToast('success', '감사합니다! 빠르게 답변드리겠습니다.')
      setSubject('')
      setEmail('')
      setMessage('')
      setFile(null)
    } catch {
      showToast('error', '네트워크 오류입니다. 다시 시도해 주세요.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — 봇만 채움, 사용자에게는 숨김 */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {/* 제목 */}
      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium text-ink mb-1.5">
          제목 <span className="text-seal">*</span>
        </label>
        <input
          id="contact-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          required
          placeholder="어떤 내용인가요?"
          className="w-full px-4 py-3 rounded-md bg-paper-raised border border-rule text-ink text-sm placeholder-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
        />
      </div>

      {/* 이메일 */}
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-ink mb-1.5">
          이메일 <span className="text-seal">*</span>
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-md bg-paper-raised border border-rule text-ink text-sm placeholder-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
        />
      </div>

      {/* 내용 */}
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-ink mb-1.5">
          내용 <span className="text-seal">*</span>
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={5000}
          required
          rows={6}
          placeholder="어떤 도움이 필요하신지 알려주세요..."
          className="w-full px-4 py-3 rounded-md bg-paper-raised border border-rule text-ink text-sm placeholder-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors resize-y min-h-[120px]"
        />
        <p className="text-right text-xs text-ink-faint mt-1">{message.length}/5,000</p>
      </div>

      {/* 첨부파일 — 공용 부품(드래그&드롭·5MB 검사 동일) */}
      <div>
        <label htmlFor="contact-file-input" className="block text-sm font-medium text-ink mb-1.5">
          첨부파일 <span className="text-ink-faint font-normal">(선택, 최대 5MB)</span>
        </label>
        <AttachmentField file={file} onChange={setFile} idPrefix="contact" />
      </div>

      {/* 전송 버튼 */}
      <button
        type="submit"
        disabled={sending}
        className="w-full flex items-center justify-center gap-2 bg-pen hover:bg-pen-dark text-white text-sm font-semibold px-6 py-3.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-pen/40"
      >
        {sending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            전송 중...
          </>
        ) : (
          <>
            <Send size={16} />
            메시지 보내기
          </>
        )}
      </button>
    </form>
  )
}
