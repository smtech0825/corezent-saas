'use client'

/**
 * @컴포넌트: LoginForm
 * @설명: 로그인 페이지 — 왼쪽 폼 / 오른쪽 로고+슬로건
 *        이메일+비밀번호, Google OAuth, GitHub OAuth 지원
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthSocialButton from '../_components/AuthSocialButton'
import AuthBrand from '../_components/AuthBrand'
import { safeInternalPath } from '@/lib/validate'

/** "아이디 저장" 이메일 보관 localStorage 키 */
const SAVED_EMAIL_KEY = 'corezent_saved_email'

/**
 * @함수명: authCallbackMessage
 * @설명: 인증 콜백이 실패하며 넘긴 종류 표시를 손님이 읽을 한국어 안내로 바꿉니다.
 *        오류 원문(영문)은 서버 기록에만 남고 여기로 넘어오지 않습니다.
 * @매개변수: code - 콜백이 넘긴 실패 종류(oauth · verify · missing)
 * @반환값: 화면에 그대로 보여줄 한국어 안내 문장
 */
function authCallbackMessage(code: string): string {
  if (code === 'oauth') {
    return '소셜 로그인을 마치지 못했습니다. 잠시 후 다시 시도하시거나 이메일로 로그인해 주세요.'
  }
  if (code === 'verify') {
    return '이메일 인증을 마치지 못했습니다. 링크가 만료되었을 수 있으니 인증 메일을 다시 받아 주세요.'
  }
  return '로그인 처리를 마치지 못했습니다. 다시 시도해 주세요.'
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // 주소로 넘어온 이동 경로는 그대로 믿지 않는다 — 바깥 주소면 조용히 홈으로 보낸다.
  // (가짜 사이트 주소를 붙인 로그인 링크가 돌면 로그인 직후 그쪽으로 넘어가기 때문)
  const redirect = safeInternalPath(searchParams.get('redirect'), '/')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | 'kakao' | 'naver' | null>(null)
  const [error, setError] = useState('')
  // 미인증(이메일 확인 전) 계정으로 로그인 시도 시 재전송 경로 노출
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  // "아이디 저장" — 체크 시에만 이메일을 localStorage에 보관하고 다음 방문 시 채운다.
  const [rememberId, setRememberId] = useState(false)

  const supabase = createClient()

  // 저장된 아이디(이메일) 불러오기 — 저장돼 있을 때만 채우고 체크박스도 켠다.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_EMAIL_KEY)
      if (saved) {
        setEmail(saved)
        setRememberId(true)
      }
    } catch { /* localStorage 접근 불가 시 무시 */ }
  }, [])

  // 인증 콜백이 실패해 돌아온 경우 — 한국어로 알리고 주소창에서 표시를 지운다.
  // (예전에는 주소에 영문 원문만 남고 화면에는 아무 설명이 없어, 손님이 같은 버튼만 계속 눌렀다)
  useEffect(() => {
    const code = searchParams.get('error')
    if (!code) return
    setError(authCallbackMessage(code))

    // 이동 경로(redirect)는 남기고 오류 표시만 지운다 — 새로고침·링크 공유 시 남지 않게.
    const params = new URLSearchParams(searchParams.toString())
    params.delete('error')
    const query = params.toString()
    router.replace(query ? `/auth/login?${query}` : '/auth/login')
  }, [searchParams, router])

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
        // 원문은 영문이라 화면에 내보내지 않는다. 사유는 브라우저 기록에만 남긴다.
        console.error('[login] 로그인 실패:', error.message)
        const raw = error.message.toLowerCase()
        if (error.message === 'Invalid login credentials') {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        } else if (raw.includes('banned')) {
          // 탈퇴 계정은 같은 이메일로 재가입도 막혀 있다(api/auth/check-email).
          // 회원가입 화면과 같은 안내로 맞춘다.
          setError('이 계정은 비활성화되었습니다. 고객센터에 문의해 주세요.')
        } else if (raw.includes('rate limit') || raw.includes('after')) {
          setError('요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.')
        } else {
          setError('로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        }
      }
      setLoading(false)
      return
    }

    // "아이디 저장" 처리 — 체크 시 이메일 보관, 아니면 제거(다음 방문 시 빈칸)
    try {
      if (rememberId) localStorage.setItem(SAVED_EMAIL_KEY, email)
      else localStorage.removeItem(SAVED_EMAIL_KEY)
    } catch { /* localStorage 접근 불가 시 무시 */ }

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
      // 원문은 영문이라 화면에 내보내지 않는다. 사유는 브라우저 기록에만 남긴다.
      console.error('[login] 인증 메일 재전송 실패:', error.message)
      setError('인증 메일을 다시 보내지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    router.push(`/auth/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(redirect)}`)
  }

  // OAuth 로그인 (Kakao / Naver / Google / GitHub)
  async function handleOAuth(provider: 'google' | 'github' | 'kakao' | 'naver') {
    setOauthLoading(provider)
    setError('')

    // 네이버는 Supabase Custom OAuth Provider 식별자(custom:naver)로 위임
    const oauthProvider = provider === 'naver' ? 'custom:naver' : provider

    // ⚠️ 카카오 scope 주의: Supabase(GoTrue) 내장 Kakao provider는
    //    account_email·profile_image·profile_nickname을 "기본 scope로 하드코딩"하고,
    //    클라이언트가 넘긴 scopes는 덮어쓰지 않고 뒤에 덧붙이기만 한다.
    //    → 프론트에서 profile_image를 제거할 수 없다. "Invalid scope: profile_image"는
    //    카카오 디벨로퍼스 > 카카오 로그인 > 동의항목에서 '프로필 사진'을 사용(선택 동의)으로
    //    설정해야 사라진다(코드로 해결 불가). 그래서 여기서 scopes를 지정하지 않는다.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: oauthProvider,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    })

    if (error) {
      console.error('[login] 소셜 로그인 시작 실패:', error.message)
      setError('소셜 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.')
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
            {/* 네이버: Supabase Custom OAuth의 UserInfo URL을 브리지(/api/auth/naver/userinfo)로
                설정해 네이버 중첩 응답을 표준 클레임으로 평탄화 → 로그인 정상화. */}
            <AuthSocialButton
              provider="naver"
              label="네이버로 시작하기"
              loading={oauthLoading === 'naver'}
              onClick={() => handleOAuth('naver')}
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

          {/* 이메일 폼 (자동완성 차단 — 저장은 "아이디 저장"으로만 제어) */}
          <form onSubmit={handleEmailLogin} autoComplete="off" className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-ink-soft mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="off"
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
                  autoComplete="off"
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

            {/* 아이디 저장 */}
            <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberId}
                onChange={(e) => setRememberId(e.target.checked)}
                className="w-4 h-4 rounded border-rule text-pen focus:ring-2 focus:ring-pen/30"
              />
              아이디 저장
            </label>

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
