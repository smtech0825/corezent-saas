/**
 * @파일: auth/callback/route.ts
 * @설명: OAuth 및 이메일 인증 콜백 처리 Route Handler
 *        Supabase가 인증 완료 후 이 URL로 리다이렉트함
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, welcomeEmailHtml } from '@/lib/email'
import { attributeReferralOnSignup, REF_COOKIE } from '@/lib/affiliate'
import { syncProviderPhoneIfMissing } from '@/lib/provider-phone'
import { safeInternalPath } from '@/lib/validate'
import { RETURN_TO_COOKIE } from '@/lib/cookies'

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
  const returnToCookie = cookieStore.get(RETURN_TO_COOKIE)?.value
  const redirectParam  = url.searchParams.get('redirect') ?? '/'
  // 우리 사이트 안의 경로만 허용한다. 쿠키는 미들웨어가 심은 값이지만 쿼리는 밖에서 붙일 수 있어
  // 둘 다 같은 검사를 통과시킨다(로그인 화면·인증 화면과 같은 검사).
  const redirect = safeInternalPath(returnToCookie ?? redirectParam, '/')

  // return_to 쿠키 삭제 헬퍼 (리다이렉트 응답에 적용)
  function withCookieCleared(res: NextResponse): NextResponse {
    if (returnToCookie) res.cookies.delete(RETURN_TO_COOKIE)
    return res
  }

  /**
   * @함수명: backToLogin
   * @설명: 인증에 실패했을 때 로그인 화면으로 되돌립니다.
   *        - 가려던 곳(redirect)을 함께 넘겨, 다시 로그인하면 원래 목적지로 갈 수 있게 한다
   *        - 실패했을 때도 return_to 쿠키를 지운다. 남겨두면 10분 동안 그 값이 항상 이겨
   *          다음 로그인이 엉뚱한 곳으로 간다
   *        - 오류 원문(영문)은 넘기지 않는다. 종류만 넘기고 문구는 로그인 화면이 고른다
   * @매개변수: reason - 실패 종류(oauth · verify · missing)
   * @반환값: 로그인 화면으로 보내는 응답
   */
  function backToLogin(reason: 'oauth' | 'verify' | 'missing'): NextResponse {
    const params = new URLSearchParams({ error: reason })
    if (redirect !== '/') params.set('redirect', redirect)
    return withCookieCleared(NextResponse.redirect(`${origin}/auth/login?${params.toString()}`))
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
      // 소셜 전화번호 자동 수집 — profiles.phone이 비어 있을 때만(카카오/네이버 등).
      // 실패해도 가입은 진행되고 온보딩 게이트가 소급 수집(검수 전에도 배포 가능).
      if (u) {
        try {
          await syncProviderPhoneIfMissing(createAdminClient(), u, data.session)
        } catch (err) {
          console.error('[callback] provider phone sync 실패:', err)
        }
      }
      return withCookieCleared(NextResponse.redirect(`${origin}${redirect}`))
    }
    // 원문(영문)은 서버 기록에만 남긴다.
    console.error('[callback] 소셜 로그인 실패:', error.message)
    return backToLogin('oauth')
  }

  // 이메일 인증 (token_hash 방식)
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    console.log('[callback] verifyOtp error:', error)
    if (!error) {
      // 비밀번호 재설정 — 전용 페이지로 이동 (세션은 이미 수립됨)
      if (type === 'recovery') {
        // 비밀번호 재설정도 "이 인증으로 할 일이 끝난" 경로다. 여기서도 흔적을 지운다
        // — 안 지우면 10분 동안 그 값이 다음 로그인의 목적지를 이긴다.
        return withCookieCleared(NextResponse.redirect(`${origin}/auth/update-password`))
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
    console.error('[callback] 이메일 인증 실패:', error.message)
    return backToLogin('verify')
  }

  // 코드도 토큰도 없이 돌아온 경우 — 가장 흔한 것이 "인증 메일 링크 만료"다. 이때 Supabase가
  // 주소에 error_code(예: otp_expired)를 붙여 보내므로, 그 값이 있으면 인증 실패로 분류해
  // 전용 안내("인증 메일을 다시 받아 주세요")가 나가게 한다. 없으면 일반 안내로 보낸다.
  const providerErrorCode = url.searchParams.get('error_code') ?? ''
  const isExpiredLink = /otp|expired|access_denied/i.test(providerErrorCode)
  console.log('[callback] no code or token_hash. error_code:', providerErrorCode || '(없음)')
  return backToLogin(isExpiredLink ? 'verify' : 'missing')
}
