/**
 * @파일: onboarding/phone/page.tsx
 * @설명: 전화번호 온보딩 게이트 페이지(서버). 보호영역 진입 시 profiles.phone이
 *        비어 있는 사용자가 리다이렉트되어 도달한다. 로그인 필수이며, 이미 전화번호가
 *        있으면(중복 진입) 원래 목적지로 되돌린다.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ONBOARDING_PHONE_PATH } from '@/lib/onboarding'
import PhoneOnboardingForm from './PhoneOnboardingForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '전화번호 등록 · CoreZent',
  description: '서비스 이용을 위해 연락 가능한 휴대폰 번호를 등록해 주세요.',
}

/** 저장 후 복귀할 경로를 안전하게 확정(내부 경로만 허용, 오픈 리다이렉트 방지) */
function safeRedirect(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//')) return v
  return '/dashboard'
}

export default async function PhoneOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>
}) {
  const sp = await searchParams
  const redirectTo = safeRedirect(sp.redirect)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(ONBOARDING_PHONE_PATH)}`)
  }

  // 이미 전화번호가 있으면 게이트를 통과한 상태 → 목적지로 복귀(중복 진입 방지)
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .single()

  if ((profile as { phone?: string | null } | null)?.phone) {
    redirect(redirectTo)
  }

  return <PhoneOnboardingForm redirectTo={redirectTo} />
}
