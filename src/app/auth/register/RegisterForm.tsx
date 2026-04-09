'use client'

/**
 * @컴포넌트: RegisterForm
 * @설명: 회원가입 페이지 — 국가 선택(필수) 포함, 법적 문서 링크 연결
 *        이메일 가입 시 이메일 인증 필수, Google / GitHub OAuth 지원
 */

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthSocialButton from '../_components/AuthSocialButton'
import AuthBrand from '../_components/AuthBrand'
import CountrySelect from '@/components/common/CountrySelect'

export default function RegisterForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const supabase = createClient()

  // 이메일 회원가입
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!country) {
      setError('Please select your country.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    setError('')

    // inactive(탈퇴) 계정 이메일 재가입 차단 사전 확인
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const { status: emailStatus } = await res.json()
      if (emailStatus === 'inactive') {
        setError('This account has been deactivated. Please contact support.')
        setLoading(false)
        return
      }
    } catch { /* 네트워크 오류 시 가입 진행 허용 */ }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, country },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Please log in.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  // OAuth 가입
  async function handleOAuth(provider: 'google' | 'github') {
    setOauthLoading(provider)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setOauthLoading(null)
    }
  }

  // 인증 메일 발송 완료 화면
  if (done) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex">
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Check your email</h1>
            <p className="text-[#94A3B8] text-sm leading-relaxed mb-6">
              We sent a verification link to{' '}
              <span className="text-white font-medium">{email}</span>.<br />
              Click the link in the email to confirm your account.
            </p>
            <p className="text-xs text-[#475569]">
              Can&apos;t find it? Check your spam folder.
            </p>
            <Link
              href="/auth/login"
              className="mt-8 inline-block text-sm text-[#38BDF8] hover:underline"
            >
              ← Back to login
            </Link>
          </div>
        </div>
        <AuthBrand />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B1120] flex">
      {/* 왼쪽: 폼 영역 */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* 모바일 로고 */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl text-white">
              <span className="w-8 h-8 rounded-lg bg-[#38BDF8] flex items-center justify-center text-[#0B1120] font-black">C</span>
              CoreZent
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
          <p className="text-[#94A3B8] text-sm mb-8">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-[#38BDF8] hover:underline">
              Log in
            </Link>
          </p>

          {/* OAuth 버튼 */}
          <div className="flex flex-col gap-3 mb-6">
            <AuthSocialButton
              provider="google"
              label="Sign up with Google"
              loading={oauthLoading === 'google'}
              onClick={() => handleOAuth('google')}
            />
            <AuthSocialButton
              provider="github"
              label="Sign up with GitHub"
              loading={oauthLoading === 'github'}
              onClick={() => handleOAuth('github')}
            />
          </div>

          {/* 구분선 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-[#1E293B]" />
            <span className="text-xs text-[#475569]">or continue with email</span>
            <div className="flex-1 h-px bg-[#1E293B]" />
          </div>

          {/* 이메일 폼 */}
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-[#94A3B8] mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full bg-[#111A2E] border border-[#1E293B] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-[#94A3B8] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-[#111A2E] border border-[#1E293B] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-[#94A3B8] mb-1.5">
                Country <span className="text-red-400">*</span>
              </label>
              <CountrySelect
                value={country}
                onChange={setCountry}
                required
                placeholder="Select your country"
              />
            </div>

            <div>
              <label className="block text-sm text-[#94A3B8] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="w-full bg-[#111A2E] border border-[#1E293B] rounded-lg px-4 py-3 pr-10 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* 비밀번호 강도 표시 */}
              {password.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        password.length >= i * 4
                          ? i === 1 ? 'bg-red-400'
                          : i === 2 ? 'bg-amber-400'
                          : 'bg-emerald-400'
                          : 'bg-[#1E293B]'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <p className="text-xs text-[#475569] leading-relaxed">
              By creating an account, you agree to our{' '}
              <a
                href="/legal/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#94A3B8] hover:text-white underline"
              >
                Terms of Service
              </a>
              {' '}and{' '}
              <a
                href="/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#94A3B8] hover:text-white underline"
              >
                Privacy Policy
              </a>.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#38BDF8] text-[#0B1120] font-semibold py-3 rounded-lg text-sm hover:bg-[#0ea5e9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>
      </div>

      {/* 오른쪽: 브랜드 영역 */}
      <AuthBrand />
    </div>
  )
}
