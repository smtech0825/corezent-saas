'use client'

/**
 * @컴포넌트: QuoteForm
 * @설명: 기관 도입 견적 요청 폼 — 전용 API(/api/quote)로 구조화 접수한다(문의와 별개 저장소).
 *        PC 수는 최소 10대 — 미만이면 보내지 않고 개인 구매(요금 페이지)로 안내한다.
 *        사업자등록번호는 형식만 가볍게 확인한다(숫자 10자리, 하이픈 허용).
 *        스팸 방지 미끼 칸(website)과 개인정보 안내 문구는 기존 문의 폼 방식 그대로.
 *        저장이 실패하면 서버가 보낸 이유를 그대로 보여준다(성공한 척 금지).
 */

import { useState } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'
import { QUOTE_MIN_PC as MIN_PC } from '@/lib/quote-constants'

const INPUT_CLS =
  'w-full bg-paper-raised border border-rule rounded-lg px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-mark transition-colors'

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

    // PC 수 — 최소 10대. 미만이면 서버로 보내지 않고 바로 개인 구매 안내(서버도 같은 검사를 한 번 더 한다).
    const seats = Math.trunc(Number(get('seats')))
    if (!Number.isInteger(seats) || seats < MIN_PC) {
      setError(`기관 견적은 ${MIN_PC}대부터 가능합니다. ${MIN_PC}대 미만 도입은 요금 페이지에서 개인 구매로 바로 이용하실 수 있습니다.`)
      return
    }

    // 사업자등록번호 — 형식만 가볍게(숫자 10자리, 하이픈 허용). 비워도 된다.
    const bizno = get('bizno').trim()
    if (bizno && !/^\d{10}$/.test(bizno.replace(/-/g, ''))) {
      setError('사업자등록번호는 숫자 10자리로 입력해 주세요. (예: 000-00-00000)')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org, email, bizno,
          dept: get('dept'), person: get('person'), phone: get('phone'),
          seats: get('seats'), needed: get('needed'), payment: get('payment'), note: get('note'),
          // 미끼 칸 — 기존 문의 폼과 같은 이름(봇 차단 로직 공유)
          website: get('website'),
        }),
      })
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
          <label htmlFor="qf-bizno" className="text-xs font-medium text-ink-soft">사업자등록번호</label>
          <input id="qf-bizno" name="bizno" inputMode="numeric" className={INPUT_CLS} placeholder="000-00-00000" />
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
          <label htmlFor="qf-seats" className="text-xs font-medium text-ink-soft">도입 예정 PC 수 <span className="text-seal">*</span> <span className="text-ink-faint">(최소 {MIN_PC}대)</span></label>
          <input id="qf-seats" name="seats" type="number" min={MIN_PC} required className={INPUT_CLS} placeholder={`${MIN_PC}`} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="qf-needed" className="text-xs font-medium text-ink-soft">필요 시기</label>
          <input id="qf-needed" name="needed" className={INPUT_CLS} placeholder="예: 2026년 9월 중" />
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
