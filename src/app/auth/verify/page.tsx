/**
 * @파일: auth/verify/page.tsx
 * @설명: 이메일 6자리 인증코드 입력 페이지(서버). 회원가입 직후, 그리고 미인증 상태로
 *        재방문해 로그인한 사용자가 공통으로 도달하는 단일 검증 경로.
 *        email·next는 쿼리로 전달받아 클라이언트 폼에 넘긴다(오픈 리다이렉트 방지).
 */

import type { Metadata } from 'next'
import VerifyForm from './VerifyForm'
import { safeInternalPath } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '이메일 인증 · CoreZent',
  description: '이메일로 발송된 6자리 인증코드를 입력해 계정을 인증해 주세요.',
}

/**
 * @함수명: VerifyPage
 * @설명: 이메일 6자리 인증코드 입력 서버 페이지. email·next 쿼리를 검증(내부 경로만)해
 *        클라이언트 폼에 전달한다.
 * @매개변수: searchParams - email(인증 대상), next(인증 후 이동 경로)
 * @반환값: 인증코드 입력 폼
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[]; next?: string | string[] }>
}) {
  const sp = await searchParams
  const email = typeof sp.email === 'string' ? sp.email : Array.isArray(sp.email) ? sp.email[0] : ''
  // 내부 경로만 허용(오픈 리다이렉트 방지) — 로그인 화면·인증 콜백과 같은 검사를 쓴다.
  const next = safeInternalPath(sp.next, '/dashboard')

  return <VerifyForm email={email} next={next} />
}
