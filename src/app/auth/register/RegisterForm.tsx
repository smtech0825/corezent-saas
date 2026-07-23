'use client'

/**
 * @컴포넌트: RegisterForm
 * @설명: 회원가입 페이지 — 법적 문서 링크 연결
 *        이메일 가입 시 이메일 인증 필수, Google / GitHub OAuth 지원
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { normalizeKoreanPhone, formatPhoneForDisplay } from '@/lib/phone'
import AuthSocialButton from '../_components/AuthSocialButton'
import AuthBrand from '../_components/AuthBrand'

export default function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | 'kakao' | 'naver' | null>(null)
  const [error, setError] = useState('')

  const supabase = createClient()

  // 이메일 회원가입
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    // 전화번호 필수 + 형식 검증(정규화 결과가 null이면 유효하지 않음)
    const normalizedPhone = normalizeKoreanPhone(phone)
    if (!normalizedPhone) {
      setError('올바른 휴대폰 번호를 입력해 주세요. (예: 010-1234-5678)')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
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
        setError('이 계정은 비활성화되었습니다. 고객센터에 문의해 주세요.')
        setLoading(false)
        return
      }
    } catch { /* 네트워크 오류 시 가입 진행 허용 */ }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // phone은 정규화된 숫자만(01012345678) 저장 — 보호영역 진입 시 profiles로 동기화됨
        data: { name, phone: normalizedPhone },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        setError('이미 가입된 이메일입니다. 로그인해 주세요.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    // 이메일 확인이 비활성(대시보드 설정)이면 signUp이 즉시 세션을 반환한다 → 이미 로그인 상태.
    // 이 경우 코드 없는 인증 화면에 가두지 않고 바로 대시보드로 보낸다.
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    // 가입 요청 성공 → 6자리 인증코드 입력 화면으로 이동(이메일 인증 후 자동 로그인)
    router.push(`/auth/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent('/dashboard')}`)
  }

  // OAuth 가입
  async function handleOAuth(provider: 'google' | 'github' | 'kakao' | 'naver') {
    setOauthLoading(provider)
    setError('')

    // 네이버는 Supabase Custom OAuth Provider 식별자(custom:naver)로 위임
    const oauthProvider = provider === 'naver' ? 'custom:naver' : provider

    const { error } = await supabase.auth.signInWithOAuth({
      provider: oauthProvider,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
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

          <h1 className="text-2xl font-serif font-black text-ink mb-1">계정 만들기</h1>
          <p className="text-ink-soft text-sm mb-8">
            이미 계정이 있으신가요?{' '}
            <Link href="/auth/login" className="text-pen hover:underline">
              로그인
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
              provider="naver"
              label="네이버로 시작하기"
              loading={oauthLoading === 'naver'}
              onClick={() => handleOAuth('naver')}
            />
            <AuthSocialButton
              provider="google"
              label="Google로 가입하기"
              loading={oauthLoading === 'google'}
              onClick={() => handleOAuth('google')}
            />
            <AuthSocialButton
              provider="github"
              label="GitHub로 가입하기"
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
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-ink-soft mb-1.5">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                required
                className="w-full bg-paper-raised border border-rule rounded-md px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
              />
            </div>

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
              <label className="block text-sm text-ink-soft mb-1.5">휴대폰 번호</label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                required
                className="w-full bg-paper-raised border border-rule rounded-md px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
              />
              {phone.length > 0 && (
                <p className={`text-xs mt-1.5 ${normalizeKoreanPhone(phone) ? 'text-emerald-600' : 'text-ink-faint'}`}>
                  {normalizeKoreanPhone(phone)
                    ? `확인: ${formatPhoneForDisplay(normalizeKoreanPhone(phone))}`
                    : '숫자만 입력하거나 010-1234-5678 형식으로 입력해 주세요.'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-ink-soft mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상 입력하세요"
                  required
                  minLength={8}
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
              {/* 비밀번호 강도 표시 */}
              {password.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        password.length >= i * 4
                          ? i === 1 ? 'bg-seal'
                          : i === 2 ? 'bg-amber-500'
                          : 'bg-emerald-600'
                          : 'bg-rule'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-seal bg-seal/5 border border-seal/30 rounded-md px-4 py-2.5">
                {error}
              </p>
            )}

            <p className="text-xs text-ink-faint leading-relaxed">
              계정을 만들면{' '}
              <a
                href="/legal/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft hover:text-ink underline"
              >
                이용약관
              </a>
              {' '}및{' '}
              <a
                href="/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft hover:text-ink underline"
              >
                개인정보처리방침
              </a>
              에 동의하는 것으로 간주됩니다.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pen text-white font-semibold py-3 rounded-md text-sm hover:bg-pen-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? '계정을 만드는 중...' : '계정 만들기'}
            </button>
          </form>
        </div>
      </div>

      {/* 오른쪽: 브랜드 영역 */}
      <AuthBrand />
    </div>
  )
}
