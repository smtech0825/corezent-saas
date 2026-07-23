'use client'

/**
 * @컴포넌트: PhoneOnboardingForm
 * @설명: 전화번호 온보딩 입력 폼(클라이언트). 단일 전화번호 필드 + 실시간 형식 검증.
 *        저장은 본인 프로필 RLS UPDATE로 처리하고, 성공 시 원래 가려던 경로로 복귀한다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { normalizeKoreanPhone, formatPhoneForDisplay } from '@/lib/phone'

export default function PhoneOnboardingForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const normalized = normalizeKoreanPhone(phone)
  const isValid = normalized !== null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const value = normalizeKoreanPhone(phone)
    if (!value) {
      setError('올바른 휴대폰 번호를 입력해 주세요. (예: 010-1234-5678)')
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login?redirect=/onboarding/phone')
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ phone: value })
      .eq('id', user.id)

    if (updateError) {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    // 서버 레이아웃 게이트가 갱신된 phone을 다시 읽도록 목적지로 이동 + 새로고침
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="theme-paper min-h-screen bg-paper text-ink flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="w-14 h-14 rounded-full bg-pen/5 border border-pen/20 flex items-center justify-center mx-auto mb-6">
          <Phone size={26} className="text-pen" />
        </div>

        <h1 className="text-2xl font-serif font-black text-ink mb-2 text-center">전화번호 등록</h1>
        <p className="text-ink-soft text-sm leading-relaxed mb-8 text-center">
          서비스 이용을 위해 연락 가능한 휴대폰 번호를 등록해 주세요.<br />
          주문·라이선스 등 중요 안내에 사용됩니다.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1.5">휴대폰 번호</label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              required
              autoFocus
              className="w-full bg-paper-raised border border-rule rounded-md px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
            />
            {/* 실시간 형식 안내 */}
            {phone.length > 0 && (
              <p className={`text-xs mt-1.5 ${isValid ? 'text-emerald-600' : 'text-ink-faint'}`}>
                {isValid
                  ? `확인: ${formatPhoneForDisplay(normalized)}`
                  : '숫자만 입력하거나 010-1234-5678 형식으로 입력해 주세요.'}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-seal bg-seal/5 border border-seal/30 rounded-md px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !isValid}
            className="w-full bg-pen text-white font-semibold py-3 rounded-md text-sm hover:bg-pen-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? '저장 중...' : '등록하고 계속하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
