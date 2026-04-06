/**
 * @파일: dashboard/layout.tsx
 * @설명: 대시보드 공통 레이아웃 — 사용자 세션 확인 후 사이드바 구성
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from './_components/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/dashboard')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_url')
    .eq('id', user.id)
    .single()

  const name = profile?.name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User'
  const initials = name[0].toUpperCase()

  return (
    <DashboardShell user={{ email: user.email ?? '', name, initials }}>
      {children}
    </DashboardShell>
  )
}
