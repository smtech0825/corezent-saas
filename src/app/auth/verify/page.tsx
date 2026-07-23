/**
 * @파일: auth/verify/page.tsx
 * @설명: 이메일 6자리 인증코드 입력 페이지(서버). 회원가입 직후, 그리고 미인증 상태로
 *        재방문해 로그인한 사용자가 공통으로 도달하는 단일 검증 경로.
 *        email·next는 쿼리로 전달받아 클라이언트 폼에 넘긴다(오픈 리다이렉트 방지).
 */

import type { Metadata } from 'next'
import VerifyForm from './VerifyForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '이메일 인증 · CoreZent',
  description: '이메일로 발송된 6자리 인증코드를 입력해 계정을 인증해 주세요.',
}

/** next는 내부 경로만 허용(오픈 리다이렉트 방지) */
function safeNext(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//')) return v
  return '/dashboard'
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[]; next?: string | string[] }>
}) {
  const sp = await searchParams
  const email = typeof sp.email === 'string' ? sp.email : Array.isArray(sp.email) ? sp.email[0] : ''
  const next = safeNext(sp.next)

  return <VerifyForm email={email} next={next} />
}
