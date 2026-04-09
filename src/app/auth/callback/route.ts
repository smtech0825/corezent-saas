/**
 * @파일: auth/callback/route.ts
 * @설명: OAuth 및 이메일 인증 콜백 처리 Route Handler
 *        Supabase가 인증 완료 후 이 URL로 리다이렉트함
 *        signup 시 국가(country) 메타데이터를 profiles에 저장
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
      // 신규 회원 이메일 인증 완료 처리
      if (type === 'signup' && data.user) {
        const user = data.user

        // 회원가입 시 입력한 country를 profiles에 저장 (비어있는 경우에만)
        const country = user.user_metadata?.country as string | undefined
        if (country) {
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({ country })
            .eq('id', user.id)
            .is('country', null)
          if (profileErr) {
            // OR 조건: country가 빈 문자열인 경우도 업데이트
            await supabase
              .from('profiles')
              .update({ country })
              .eq('id', user.id)
              .eq('country', '')
          }
        }

        // 웰컴 이메일 발송
        if (user.email) {
          sendEmail({
            to: user.email,
            subject: 'Welcome to CoreZent!',
            html: welcomeEmailHtml('CoreZent'),
          }).catch((err) => console.error('[email] 웰컴 이메일 발송 실패:', err))
        }
      }
      return NextResponse.redirect(`${origin}${redirect}`)
    }
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  console.log('[callback] no code or token_hash. params:', Object.fromEntries(url.searchParams))
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
