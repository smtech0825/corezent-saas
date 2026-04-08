/**
 * @파일: auth/callback/route.ts
 * @설명: OAuth 및 이메일 인증 콜백 처리 Route Handler
 *        Supabase가 인증 완료 후 이 URL로 리다이렉트함
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, welcomeEmailHtml } from '@/lib/email'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as 'magiclink' | 'email' | 'signup' | 'recovery' | null
  const redirect = url.searchParams.get('redirect') ?? '/'
  const origin = url.origin

  const supabase = await createClient()

  // Google/GitHub OAuth 코드 교환
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[callback] code exchange error:', error)
    if (!error) return NextResponse.redirect(`${origin}${redirect}`)
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  // 이메일 인증 (token_hash 방식)
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    console.log('[callback] verifyOtp error:', error)
    if (!error) {
      // 신규 회원 이메일 인증 완료 시 웰컴 이메일 발송
      if (type === 'signup' && data.user?.email) {
        sendEmail({
          to: data.user.email,
          subject: 'Welcome to CoreZent!',
          html: welcomeEmailHtml('CoreZent'),
        }).catch((err) => console.error('[email] 웰컴 이메일 발송 실패:', err))
      }
      return NextResponse.redirect(`${origin}${redirect}`)
    }
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  console.log('[callback] no code or token_hash. params:', Object.fromEntries(url.searchParams))
  // 오류 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
