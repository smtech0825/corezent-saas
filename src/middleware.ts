/**
 * @파일: middleware.ts
 * @설명: 세션 쿠키 갱신 미들웨어
 *        모든 요청마다 Supabase 세션을 자동으로 리프레시함
 *        보호된 라우트(/dashboard, /admin) 접근 제어
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { RETURN_TO_COOKIE } from '@/lib/cookies'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // 세션 리프레시 (이 줄 삭제 금지)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 비로그인 사용자가 보호 경로 접근 시 로그인 페이지로 리다이렉트
  const protectedPaths = ['/dashboard', '/admin']
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', pathname)
    // 로그인 후 돌아갈 경로를 쿠키에도 저장 (OAuth 플로우에서 query param이 유실될 때 대비)
    const res = NextResponse.redirect(url)
    res.cookies.set(RETURN_TO_COOKIE, pathname, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10분
      path: '/',
    })
    return res
  }

  // 로그인한 사용자가 보호 경로에 도착하면 "돌아갈 경로" 흔적을 지운다.
  // 이 쿠키는 로그인 후 한 번 쓰고 버리는 임시 표시인데, 이메일+비밀번호로 로그인하면
  // 인증 콜백을 거치지 않아 지워질 기회가 없다. 남으면 10분 동안 다음 로그인의 목적지를
  // 이겨 엉뚱한 곳으로 보낸다. 인증 콜백은 보호 경로가 아니라 이 정리에 걸리지 않으므로,
  // 콜백이 값을 읽을 기회를 빼앗지 않는다.
  if (isProtected && user && request.cookies.has(RETURN_TO_COOKIE)) {
    supabaseResponse.cookies.delete(RETURN_TO_COOKIE)
  }

  // 관리자 경로: 로그인 여부만 체크 (role 검증은 admin/layout.tsx에서 service role key로 처리)
  // middleware에서 profiles 조회 시 RLS 재귀 문제 발생 가능성으로 제거

  // 이미 로그인된 사용자가 auth 페이지 접근 시 대시보드로 리다이렉트
  const authPaths = ['/auth/login', '/auth/register']
  if (authPaths.includes(pathname) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
