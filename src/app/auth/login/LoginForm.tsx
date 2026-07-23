'use client'

/**
 * @컴포넌트: LoginForm
 * @설명: 로그인 페이지 — 왼쪽 폼 / 오른쪽 로고+슬로건
 *        이메일+비밀번호, Google OAuth, GitHub OAuth 지원
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthSocialButton from '../_components/AuthSocialButton'
import AuthBrand from '../_components/AuthBrand'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | 'kakao' | null>(null)
  const [error, setError] = useState('')
  // 미인증(이메일 확인 전) 계정으로 로그인 시도 시 재전송 경로 노출
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const supabase = createClient()

  // 이메일+비밀번호 로그인
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNeedsConfirm(false)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // 이메일 미인증 계정: 인증 코드 재전송 경로 안내(기존 확인 계정 로그인은 영향 없음)
      const isUnconfirmed =
        error.message === 'Email not confirmed' ||
        (error as { code?: string }).code === 'email_not_confirmed'
      if (isUnconfirmed) {
        setNeedsConfirm(true)
        setError('이메일 인증이 완료되지 않았습니다. 가입 시 받은 6자리 코드로 인증해 주세요.')
      } else {
        setError(error.message === 'Invalid login credentials'
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : error.message)
      }
      setLoading(false)
      return
    }

    router.push(redirect)
    router.refresh()
  }

  // 미인증 계정: 인증 코드 재전송 후 검증 페이지로 이동
  async function handleResendConfirm() {
    if (!email) {
      setError('이메일을 입력해 주세요.')
      return
    }
    setResendLoading(true)
    setError('')

    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResendLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    router.push(`/auth/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(redirect)}`)
  }

  // OAuth 로그인 (Kakao / Google / GitHub)
  async function handleOAuth(provider: 'google' | 'github' | 'kakao') {
    setOauthLoading(provider)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?redirect=${redirect}`,
      },
    })

    if (error) {
      setError(error.message)
      setOauthLoading(null)
    }
  }

  return (
    <div className="theme-paper min-h-screen bg-paper text-ink flex">
      {/* 왼쪽: 폼 영역 */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* 모바일 로고 */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl text-ink">
              <span className="w-7 h-7 rounded border-[1.5px] border-seal flex items-center justify-center text-seal font-black -rotate-3">C</span>
              CoreZent
            </Link>
          </div>

          <h1 className="text-2xl font-serif font-black text-ink mb-1">다시 오신 것을 환영합니다</h1>
          <p className="text-ink-soft text-sm mb-8">
            계정이 없으신가요?{' '}
            <Link href="/auth/register" className="text-pen hover:underline">
              회원가입
            </Link>
          </p>

          {/* OAuth 버튼 */}
          <div className="flex flex-col gap-3 mb-6">
            <AuthSocialButton
              provider="kakao"
              label="카카오로 시작하기"
              loading={oauthLoading === 'kakao'}
              onClick={() => handleOAuth('kakao')}
            />
            <AuthSocialButton
              provider="google"
              label="Google로 계속하기"
              loading={oauthLoading === 'google'}
              onClick={() => handleOAuth('google')}
            />
            <AuthSocialButton
              provider="github"
              label="GitHub로 계속하기"
              loading={oauthLoading === 'github'}
              onClick={() => handleOAuth('github')}
            />
          </div>

          {/* 구분선 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-rule" />
            <span className="text-xs text-ink-faint">또는 이메일로 계속하기</span>
            <div className="flex-1 h-px bg-rule" />
          </div>

          {/* 이메일 폼 */}
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-ink-soft mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-paper-raised border border-rule rounded-md px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm text-ink-soft">비밀번호</label>
                <Link href="/auth/reset-password" className="text-xs text-pen hover:underline">
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-paper-raised border border-rule rounded-md px-4 py-3 pr-10 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-soft transition-colors focus-visible:ring-2 focus-visible:ring-pen/40 rounded"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-seal bg-seal/5 border border-seal/30 rounded-md px-4 py-2.5">
                {error}
              </p>
            )}

            {/* 미인증 계정: 인증 코드 재전송 경로 */}
            {needsConfirm && (
              <button
                type="button"
                onClick={handleResendConfirm}
                disabled={resendLoading}
                className="w-full border border-pen/40 text-pen font-semibold py-3 rounded-md text-sm hover:bg-pen/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resendLoading && <Loader2 size={15} className="animate-spin" />}
                {resendLoading ? '코드 전송 중...' : '인증 코드 받고 인증하기 →'}
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pen text-white font-semibold py-3 rounded-md text-sm hover:bg-pen-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>

      {/* 오른쪽: 브랜드 영역 (lg 이상에서만 표시) */}
      <AuthBrand />
    </div>
  )
}
