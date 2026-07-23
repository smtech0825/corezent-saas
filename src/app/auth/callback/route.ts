/**
 * @파일: auth/callback/route.ts
 * @설명: OAuth 및 이메일 인증 콜백 처리 Route Handler
 *        Supabase가 인증 완료 후 이 URL로 리다이렉트함
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, welcomeEmailHtml } from '@/lib/email'
import { attributeReferralOnSignup, REF_COOKIE } from '@/lib/affiliate'

// OAuth 신규 가입 판별 윈도우 — user.created_at가 콜백 직전 이 시간 이내면
// '이번 인증으로 막 생성된 신규'로 본다. 기존 사용자는 created_at가 과거라 통과하지 않으므로
// 윈도우를 넉넉히 둬도 오귀속 위험이 없다(false-negative-safe).
const NEW_SIGNUP_WINDOW_MS = 5 * 60 * 1000

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as 'magiclink' | 'email' | 'signup' | 'recovery' | null
  const origin = url.origin

  // 돌아갈 경로 결정: return_to 쿠키 → ?redirect 쿼리 → 기본값 '/'
  const cookieStore = await cookies()
  const returnToCookie = cookieStore.get('return_to')?.value
  const redirectParam  = url.searchParams.get('redirect') ?? '/'
  const redirect = returnToCookie ?? redirectParam

  // return_to 쿠키 삭제 헬퍼 (리다이렉트 응답에 적용)
  function withCookieCleared(res: NextResponse): NextResponse {
    if (returnToCookie) res.cookies.delete('return_to')
    return res
  }

  const supabase = await createClient()

  // Google/GitHub OAuth 코드 교환
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[callback] code exchange error:', error)
    if (!error) {
      // OAuth '확실한 신규 가입'에 한해 추천 귀속 — 이메일 가입과 동일 헬퍼 재사용(로직 복제 없음).
      // 신규 판별: user.created_at가 콜백 직전 NEW_SIGNUP_WINDOW_MS 이내. 기존 사용자는 과거 created_at라
      // 통과하지 않아 오귀속이 없다. 확신 없으면 skip(false-negative-safe).
      // 자기추천 차단·referred_by 1회 기록·attribution 중복 방지는 헬퍼 내부에서 처리한다.
      const u = data.user
      const createdMs = u?.created_at ? new Date(u.created_at).getTime() : NaN
      const isFreshSignup = Number.isFinite(createdMs) && Date.now() - createdMs <= NEW_SIGNUP_WINDOW_MS
      if (u && isFreshSignup) {
        await attributeReferralOnSignup(u.id, cookieStore.get(REF_COOKIE)?.value)
      }
      return withCookieCleared(NextResponse.redirect(`${origin}${redirect}`))
    }
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  // 이메일 인증 (token_hash 방식)
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    console.log('[callback] verifyOtp error:', error)
    if (!error) {
      // 비밀번호 재설정 — 전용 페이지로 이동 (세션은 이미 수립됨)
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/update-password`)
      }

      // 신규 회원 이메일 인증 완료 처리
      if (type === 'signup' && data.user) {
        const user = data.user

        // 추천 귀속: cz_ref 쿠키의 추천 코드를 referred_by에 기록 + 귀속 행 생성
        // (자기추천 차단·중복 방지는 유틸 내부에서 처리, 실패해도 가입 흐름 유지)
        await attributeReferralOnSignup(user.id, cookieStore.get(REF_COOKIE)?.value)

        // 웰컴 이메일 발송
        if (user.email) {
          sendEmail({
            to: user.email,
            subject: 'CoreZent 가입을 환영합니다',
            html: welcomeEmailHtml('CoreZent'),
          }).catch((err) => console.error('[email] 웰컴 이메일 발송 실패:', err))
        }
      }
      return withCookieCleared(NextResponse.redirect(`${origin}${redirect}`))
    }
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  console.log('[callback] no code or token_hash. params:', Object.fromEntries(url.searchParams))
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
