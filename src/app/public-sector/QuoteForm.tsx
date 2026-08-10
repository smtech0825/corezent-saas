'use client'

/**
 * @컴포넌트: QuoteForm
 * @설명: 기관 도입 견적 요청 폼. 새 테이블을 만들지 않고 기존 문의 API(/api/contact)를
 *        그대로 재사용한다 — 입력값을 사람이 읽는 형태로 조합해 message에 담아 보낸다.
 *        스팸 방지 미끼 칸(website)과 필드 이름은 기존 문의 폼과 동일하게 맞춘다.
 */

import { useState } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'

const INPUT_CLS =
  'w-full bg-paper-raised border border-rule rounded-lg px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-mark transition-colors'

/** 입력값을 문의 본문 한 통으로 조합한다. 값이 빈 항목은 줄 자체를 넣지 않는다. */
function buildMessage(f: Record<string, string>): string {
  const lines: [string, string][] = [
    ['기관명', f.org],
    ['부서', f.dept],
    ['담당자', f.person],
    ['연락처', f.phone],
    ['도입 예정 PC 수', f.seats],
    ['희망 결제 방식', f.payment],
  ]
  const head = lines.filter(([, v]) => v.trim()).map(([k, v]) => `${k}: ${v.trim()}`).join('\n')
  const note = f.note.trim() ? `\n\n[추가 요청사항]\n${f.note.trim()}` : ''
  return `${head}${note}`
}

export default function QuoteForm() {
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const el = e.currentTarget.elements as unknown as Record<string, HTMLInputElement | undefined>
    const get = (n: string) => el[n]?.value ?? ''

    const org = get('org').trim()
    const email = get('email').trim()
    if (!org || !email) {
      setError('기관명과 이메일은 필수입니다.')
      return
    }

    setSending(true)
    try {
      const body = new FormData()
      body.append('email', email)
      body.append('subject', `[기관 견적 요청] ${org}`)
      body.append('message', buildMessage({
        org, dept: get('dept'), person: get('person'), phone: get('phone'),
        seats: get('seats'), payment: get('payment'), note: get('note'),
      }))
      // 미끼 칸 — 기존 문의 폼과 같은 이름으로 함께 보낸다(봇 차단 로직 공유)
      body.append('website', get('website'))

      const res = await fetch('/api/contact', { method: 'POST', body })
      // 서버가 이유를 담아 보내면 그대로 보여준다 — 횟수 초과(429)·저장 실패(500)를
      // "전송 실패" 한 문구로 뭉뚱그리면 손님이 원인을 몰라 계속 재시도한다.
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      setDone(true)
    } catch {
      setError('네트워크 오류입니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="border border-rule bg-paper-raised rounded-2xl p-8 text-center">
        <CheckCircle size={28} className="text-ok mx-auto mb-3" />
        <p className="text-sm font-semibold text-ink">견적 요청이 접수되었습니다.</p>
        <p className="text-sm text-ink-soft mt-1.5">입력하신 이메일로 회신드리겠습니다.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-rule bg-paper-raised rounded-2xl p-6 sm:p-8 space-y-4">
      {/* 미끼 칸 — 봇만 채운다. 화면 밖으로 빼고 보조기기·탭 이동에서도 제외한다 */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="qf-website">Website</label>
        <input type="text" id="qf-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="qf-org" className="text-xs font-medium text-ink-soft">기관명 <span className="text-seal">*</span></label>
          <input id="qf-org" name="org" required className={INPUT_CLS} placeholder="○○시청" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="qf-dept" className="text-xs font-medium text-ink-soft">부서</label>
          <input id="qf-dept" name="dept" className={INPUT_CLS} placeholder="○○과" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="qf-person" className="text-xs font-medium text-ink-soft">담당자</label>
          <input id="qf-person" name="person" className={INPUT_CLS} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="qf-email" className="text-xs font-medium text-ink-soft">이메일 <span className="text-seal">*</span></label>
          <input id="qf-email" name="email" type="email" required className={INPUT_CLS} placeholder="name@korea.kr" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="qf-phone" className="text-xs font-medium text-ink-soft">연락처</label>
          <input id="qf-phone" name="phone" className={INPUT_CLS} placeholder="02-000-0000" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="qf-seats" className="text-xs font-medium text-ink-soft">도입 예정 PC 수</label>
          <input id="qf-seats" name="seats" type="number" min="1" className={INPUT_CLS} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="qf-payment" className="text-xs font-medium text-ink-soft">희망 결제 방식</label>
        <select id="qf-payment" name="payment" defaultValue="" className={INPUT_CLS}>
          <option value="">선택 안 함</option>
          <option value="기관 예산(견적서 필요)">기관 예산 — 견적서 필요</option>
          <option value="계좌이체">계좌이체</option>
          <option value="카드 결제">카드 결제</option>
          <option value="미정">미정 · 상담 희망</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="qf-note" className="text-xs font-medium text-ink-soft">추가 요청사항</label>
        <textarea id="qf-note" name="note" rows={4} className={`${INPUT_CLS} resize-y`} placeholder="도입 일정, 필요한 서류 등을 적어주세요." />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 bg-mark text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-60 transition-colors"
        >
          {sending && <Loader2 size={14} className="animate-spin" />}
          {sending ? '보내는 중…' : '견적 요청 보내기'}
        </button>
        <p className="text-xs text-ink-faint">
          입력하신 기관·담당자 정보는 견적 회신 목적으로만 사용합니다.{' '}
          <a href="/legal/privacy" className="underline hover:text-ink-soft">개인정보처리방침</a>
        </p>
      </div>
    </form>
  )
}
