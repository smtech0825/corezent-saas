/**
 * @파일: dashboard/layout.tsx
 * @설명: 대시보드 공통 레이아웃 — 세션 확인 + 지원 뱃지 카운트
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

  // 미읽은 관리자 답변 뱃지 카운트
  // status='answered' 이고 (user_last_read_at이 없거나 updated_at보다 이전) 인 티켓
  const { data: answeredTickets } = await supabase
    .from('support_tickets')
    .select('user_last_read_at, updated_at')
    .eq('user_id', user.id)
    .eq('status', 'answered')

  const supportBadge = (answeredTickets ?? []).filter(
    (t) => !t.user_last_read_at || t.user_last_read_at < t.updated_at
  ).length

  return (
    <DashboardShell
      user={{ email: user.email ?? '', name, initials }}
      supportBadge={supportBadge}
    >
      {children}
    </DashboardShell>
  )
}
