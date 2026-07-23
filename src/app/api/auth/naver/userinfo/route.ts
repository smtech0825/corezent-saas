/**
 * @파일: api/auth/naver/userinfo/route.ts
 * @설명: 네이버 UserInfo 브리지. Supabase Custom OAuth(Manual)는 UserInfo 응답의
 *        표준 클레임(sub·email·name)을 최상위에서 읽는데, 네이버 /v1/nid/me는
 *        데이터를 `response` 아래에 중첩해 주기 때문에 Supabase가 email/식별자를 못 찾아
 *        로그인이 실패한다("Error getting user email from external provider").
 *        이 브리지가 Supabase의 Bearer 토큰을 네이버로 그대로 전달하고, 네이버의
 *        중첩 응답을 표준 클레임으로 평탄화해 반환한다.
 *        → Supabase Custom OAuth Provider의 UserInfo URL을 이 경로로 설정한다.
 *
 * 보안: 유효한 네이버 access token(Authorization: Bearer)이 없으면 네이버가 401을 주므로
 *       토큰 없는 호출은 아무 정보도 반환하지 않는다(별도 시크릿 불필요, server-to-server 호출).
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** 네이버 사용자정보 API 응답 형태(필요한 필드만) */
interface NaverMeResponse {
  resultcode?: string
  message?: string
  response?: {
    id?: string
    email?: string | null
    name?: string | null
    nickname?: string | null
    mobile?: string | null
    mobile_e164?: string | null
  }
}

/**
 * @함수명: GET
 * @설명: Supabase가 보낸 Authorization(Bearer 네이버 토큰)으로 네이버 /v1/nid/me를 호출하고,
 *        중첩된 response를 표준 OIDC 유사 클레임으로 평탄화해 반환한다.
 * @매개변수: req - Authorization 헤더를 포함한 요청
 * @반환값: { sub, email, email_verified, name, preferred_username, mobile, mobile_e164 } JSON
 */
export async function GET(req: NextRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 })
  }

  let data: NaverMeResponse
  try {
    const res = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'naver_userinfo_failed' }, { status: res.status })
    }
    data = (await res.json()) as NaverMeResponse
  } catch {
    return NextResponse.json({ error: 'naver_userinfo_unreachable' }, { status: 502 })
  }

  const r = data.response
  // 네이버가 정상 응답(resultcode '00')이고 고유 식별자(id)가 있어야 로그인 성립
  if (data.resultcode !== '00' || !r?.id) {
    return NextResponse.json({ error: 'naver_invalid_response' }, { status: 502 })
  }

  // 표준 클레임으로 평탄화. undefined 필드는 JSON 직렬화 시 자동 제외됨.
  // email_verified=true: 네이버 계정 이메일은 검증된 값이므로 동일 이메일 자동 연결이 동작하도록 표시.
  return NextResponse.json({
    sub: String(r.id),
    email: r.email ?? undefined,
    email_verified: r.email ? true : undefined,
    name: r.name ?? r.nickname ?? undefined,
    preferred_username: r.nickname ?? undefined,
    // 전화번호도 함께 노출(참고용) — 실제 profiles.phone 저장은 콜백의 provider-phone 모듈이 담당
    mobile: r.mobile ?? undefined,
    mobile_e164: r.mobile_e164 ?? undefined,
  })
}
