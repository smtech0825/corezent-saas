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
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)
  const [error, setError] = useState('')

  const supabase = createClient()

  // 이메일+비밀번호 로그인
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : error.message)
      setLoading(false)
      return
    }

    router.push(redirect)
    router.refresh()
  }

  // OAuth 로그인 (Google / GitHub)
  async function handleOAuth(provider: 'google' | 'github') {
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

          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-[#94A3B8] text-sm mb-8">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-[#38BDF8] hover:underline">
              Sign up
            </Link>
          </p>

          {/* OAuth 버튼 */}
          <div className="flex flex-col gap-3 mb-6">
            <AuthSocialButton
              provider="google"
              label="Continue with Google"
              loading={oauthLoading === 'google'}
              onClick={() => handleOAuth('google')}
            />
            <AuthSocialButton
              provider="github"
              label="Continue with GitHub"
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
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-[#94A3B8] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-[#111A2E] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm text-[#94A3B8]">Password</label>
                <Link href="/auth/reset-password" className="text-xs text-[#38BDF8] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#111A2E] border border-[#1E293B] rounded-lg px-4 py-2.5 pr-10 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#38BDF8] text-[#0B1120] font-semibold py-2.5 rounded-lg text-sm hover:bg-[#0ea5e9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        </div>
      </div>

      {/* 오른쪽: 브랜드 영역 (lg 이상에서만 표시) */}
      <AuthBrand />
    </div>
  )
}
