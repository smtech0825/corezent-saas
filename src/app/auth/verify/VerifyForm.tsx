'use client'

/**
 * @컴포넌트: VerifyForm
 * @설명: 이메일 6자리 인증코드 입력 폼(클라이언트).
 *        - verifyOtp({ email, token, type: 'signup' })로 가입 확인 + 자동 로그인.
 *        - 재전송은 resend({ type: 'signup', email }) + 60초 쿨다운(서버도 최소 간격 강제).
 *        - 성공 시 next 경로로 이동(기본 /dashboard). 이후 온보딩 게이트가 전화번호를 동기화.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const RESEND_COOLDOWN = 60 // 초 — Supabase 서버측 최소 재전송 간격과 정합

export default function VerifyForm({ email, next }: { email: string; next: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  // 진입 시 이미 코드가 발송된 상태로 간주 → 쿨다운부터 시작
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)

  // 쿨다운 카운트다운
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const isValidCode = /^\d{6}$/.test(code)

  // 인증코드 확인 → 자동 로그인
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!isValidCode) {
      setError('6자리 숫자 코드를 입력해 주세요.')
      return
    }

    setLoading(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    })

    if (verifyError) {
      const msg = verifyError.message.toLowerCase()
      if (msg.includes('expired') || msg.includes('invalid')) {
        setError('인증 코드가 올바르지 않거나 만료되었습니다. 코드를 다시 확인하거나 재전송해 주세요.')
      } else {
        setError(verifyError.message)
      }
      setLoading(false)
      return
    }

    // 인증 성공 = 세션 수립(자동 로그인) → 목적지로 이동, 서버 컴포넌트 갱신
    router.push(next)
    router.refresh()
  }

  // 인증코드 재전송
  async function handleResend() {
    if (cooldown > 0 || resendLoading) return
    setError('')
    setInfo('')
    setResendLoading(true)

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    setResendLoading(false)

    if (resendError) {
      // 서버가 최소 간격을 강제하면 여기서 에러가 온다(그대로 안내)
      setError(
        resendError.message.toLowerCase().includes('after')
          ? '잠시 후 다시 시도해 주세요. (재전송 간격 제한)'
          : resendError.message,
      )
      return
    }

    setInfo('인증 코드를 다시 보냈습니다. 이메일을 확인해 주세요.')
    setCooldown(RESEND_COOLDOWN)
  }

  // 이메일 정보가 없으면(직접 접근 등) 안내
  if (!email) {
    return (
      <div className="theme-paper min-h-screen bg-paper text-ink flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-serif font-black text-ink mb-3">잘못된 접근입니다</h1>
          <p className="text-ink-soft text-sm mb-6">인증할 이메일 정보가 없습니다. 다시 시도해 주세요.</p>
          <Link href="/auth/register" className="text-sm text-pen hover:underline">
            ← 회원가입으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="theme-paper min-h-screen bg-paper text-ink flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="w-14 h-14 rounded-full bg-pen/5 border border-pen/20 flex items-center justify-center mx-auto mb-6">
          <MailCheck size={26} className="text-pen" />
        </div>

        <h1 className="text-2xl font-serif font-black text-ink mb-2 text-center">이메일 인증</h1>
        <p className="text-ink-soft text-sm leading-relaxed mb-8 text-center">
          <span className="text-ink font-medium break-all">{email}</span>
          {' '}주소로 보낸<br />6자리 인증 코드를 입력해 주세요.
        </p>

        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1.5">인증 코드</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              autoFocus
              maxLength={6}
              className="w-full bg-paper-raised border border-rule rounded-md px-4 py-3 text-center text-lg tracking-[0.4em] font-mono text-ink placeholder:text-ink-faint placeholder:tracking-[0.4em] focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-seal bg-seal/5 border border-seal/30 rounded-md px-4 py-2.5">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-emerald-700 bg-emerald-500/5 border border-emerald-500/30 rounded-md px-4 py-2.5">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !isValidCode}
            className="w-full bg-pen text-white font-semibold py-3 rounded-md text-sm hover:bg-pen-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? '인증 중...' : '인증하고 계속하기'}
          </button>
        </form>

        {/* 재전송 */}
        <div className="mt-6 text-center text-sm text-ink-soft">
          코드를 받지 못하셨나요?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resendLoading}
            className="text-pen hover:underline disabled:text-ink-faint disabled:no-underline disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            {resendLoading && <Loader2 size={12} className="animate-spin" />}
            {cooldown > 0 ? `재전송 (${cooldown}초)` : '인증 코드 재전송'}
          </button>
        </div>

        <div className="mt-8 text-center">
          <Link href="/auth/login" className="text-sm text-ink-faint hover:text-ink-soft">
            ← 로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
