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

  // 로그인한 사용자가 어디든 도착하면 "돌아갈 경로" 흔적을 지운다.
  // 이 쿠키는 로그인 후 한 번 쓰고 버리는 임시 표시인데, 이메일+비밀번호로 로그인하면
  // 인증 콜백을 거치지 않아 지워질 기회가 없다. 남으면 10분 동안 다음 로그인의 목적지를
  // 이겨 엉뚱한 곳으로 보낸다. 예전에는 "보호 경로 도착"일 때만 지워서, 로그인 후
  // 목적지가 홈(/) 등이면 흔적이 남았다 — 지우는 목적은 "로그인이 끝났다"이지
  // "어디에 도착했다"가 아니므로 조건을 로그인 여부로만 잡는다.
  // 인증 콜백(/auth/callback)이 값을 읽을 기회는 빼앗지 않는다: 여기서 지우는 것은
  // 응답 쿠키라 콜백 핸들러가 읽는 요청 쿠키는 그대로이고, 콜백을 밟는 시점의 손님은
  // 아직 세션이 없어(user 없음) 이 정리에 걸리지도 않는다. 콜백은 네 출구 전부에서
  // 스스로 지운다(withCookieCleared).
  if (user && request.cookies.has(RETURN_TO_COOKIE)) {
    supabaseResponse.cookies.delete(RETURN_TO_COOKIE)
  }

  // 관리자 경로: 로그인 여부만 체크 (role 검증은 admin/layout.tsx에서 service role key로 처리)
  // middleware에서 profiles 조회 시 RLS 재귀 문제 발생 가능성으로 제거

  // 이미 로그인된 사용자가 auth 페이지 접근 시 대시보드로 리다이렉트 (기존 동작 유지)
  //
  // 단 한 가지 예외: 인증 콜백이 실패 안내를 들고 로그인 화면으로 보낸 경우(?error=)는
  // 그대로 둔다. 만료된 인증 메일 링크를 로그인 상태에서 누르면 여기서 튕겨나가
  // "왜 안 됐는지"를 볼 기회가 사라지기 때문이다(같은 링크를 두 번 누르거나 메일 보안
  // 검사가 링크를 먼저 열어버린 경우에 흔하다).
  // 예외는 로그인 화면 + error 값이 있을 때로만 좁혔다 — 나머지 이동 규칙은 그대로다.
  const authPaths = ['/auth/login', '/auth/register']
  const hasCallbackNotice =
    pathname === '/auth/login' && request.nextUrl.searchParams.has('error')
  if (authPaths.includes(pathname) && user && !hasCallbackNotice) {
    const res = NextResponse.redirect(new URL('/dashboard', request.url))
    // 새 응답을 만들면 supabaseResponse에 예약해 둔 응답 쿠키(위의 return_to 삭제,
    // getUser()가 갱신한 세션 쿠키)가 통째로 버려진다 — 이 출구만 정리가 빠지는
    // "한쪽만"이 되지 않도록 예약분을 그대로 옮겨 싣는다. 이동 조건·목적지는 그대로다.
    supabaseResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie))
    return res
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
