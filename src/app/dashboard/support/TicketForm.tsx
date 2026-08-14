'use client'

/**
 * @컴포넌트: TicketForm
 * @설명: 로그인 고객의 새 문의 폼 — 제목·문의 유형·우선순위·내용·첨부(공용 AttachmentField).
 *        page.tsx에 있던 폼을 분리한 것. 서버 액션의 결과값을 받아 실패를 화면에 알린다
 *        (기존에는 실패해도 무음이었다). 성공하면 입력을 비우고, 실패하면 입력을 보존한다.
 */

import { useRef, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import SelectField from '@/components/common/SelectField'
import AttachmentField from '@/components/common/AttachmentField'
import { useToast } from '@/components/common/Toast'
import { SUPPORT_CATEGORIES } from '@/lib/support-categories'

/** 서버 액션 결과 — 실패 사유는 화면에 그대로 보여줄 한국어 문장 */
export type TicketSubmitResult = { ok: true } | { ok: false; reason: string }

const priorityOptions = [
  { value: 'low', label: '낮음' },
  { value: 'normal', label: '보통' },
  { value: 'high', label: '높음' },
  { value: 'urgent', label: '긴급' },
]

export default function TicketForm({ action }: {
  /** 서버 액션 — FormData(제목·유형·우선순위·내용·첨부)를 받아 결과를 돌려준다 */
  action: (formData: FormData) => Promise<TicketSubmitResult>
}) {
  const { showToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * @함수명: handleSubmit
   * @설명: 폼 값을 서버 액션에 보내고 결과를 알립니다. 실패하면 입력이 지워지지 않습니다.
   */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    if (isPending) return
    setError(null)

    const formData = new FormData(e.currentTarget)
    if (file) formData.set('attachment', file)

    startTransition(async () => {
      try {
        const res = await action(formData)
        if (!res.ok) {
          setError(res.reason)
          return
        }
        showToast('success', '문의가 접수되었습니다. 최대한 빠르게 답변드리겠습니다.')
        formRef.current?.reset()
        setFile(null)
      } catch {
        setError('문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
      {/* 제목 */}
      <div className="space-y-1.5">
        <label htmlFor="subject" className="text-xs font-medium text-ink-soft">
          제목 <span className="text-danger">*</span>
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          placeholder="문의 내용을 간단히 적어주세요"
          className="w-full bg-paper border border-rule rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-mark/50 focus:ring-1 focus:ring-mark/20 transition-colors"
        />
      </div>

      {/* 문의 유형 + 우선순위 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="category" className="text-xs font-medium text-ink-soft">문의 유형</label>
          <SelectField size="md" id="category" name="category" defaultValue="other">
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </SelectField>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="priority" className="text-xs font-medium text-ink-soft">우선순위</label>
          <SelectField size="md" id="priority" name="priority" defaultValue="normal">
            {priorityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </SelectField>
        </div>
      </div>

      {/* 메시지 */}
      <div className="space-y-1.5">
        <label htmlFor="message" className="text-xs font-medium text-ink-soft">
          내용 <span className="text-danger">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="문의 내용을 자세히 적어주세요..."
          className="w-full bg-paper border border-rule rounded-xl px-4 py-2.5 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-mark/50 focus:ring-1 focus:ring-mark/20 transition-colors resize-none"
        />
      </div>

      {/* 첨부 — 비회원 문의 폼과 같은 공용 부품(5MB) */}
      <div className="space-y-1.5">
        <label htmlFor="ticket-file-input" className="text-xs font-medium text-ink-soft">
          첨부파일 <span className="text-ink-faint font-normal">(선택, 최대 5MB — 오류 화면 캡처 등)</span>
        </label>
        <AttachmentField file={file} onChange={setFile} idPrefix="ticket" />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger bg-danger-soft border border-danger/20 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="flex justify-stretch sm:justify-end pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-mark hover:brightness-95 text-white font-semibold text-sm px-5 py-3 sm:py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {isPending && <Loader2 size={14} className="animate-spin" aria-hidden />}
          {isPending ? '접수 중…' : '문의 제출'}
        </button>
      </div>
    </form>
  )
}
