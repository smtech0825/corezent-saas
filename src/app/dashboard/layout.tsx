/**
 * @파일: dashboard/layout.tsx
 * @설명: 대시보드 공통 레이아웃 — 세션 확인 + role 조회 + 지원 뱃지 카운트
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DashboardShell from './_components/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/dashboard')

  // role 포함하여 프로필 조회 (RLS 우회 위해 adminClient 사용)
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('name, avatar_url, role')
    .eq('id', user.id)
    .single()

  const name     = profile?.name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User'
  const initials = name[0].toUpperCase()
  const isAdmin  = profile?.role === 'admin'

  // 미읽은 관리자 답변 뱃지 카운트
  let supportBadge = 0
  try {
    const { data: answeredTickets, error: badgeErr } = await supabase
      .from('support_tickets')
      .select('user_last_read_at, updated_at')
      .eq('user_id', user.id)
      .eq('status', 'answered')

    if (!badgeErr && answeredTickets) {
      supportBadge = answeredTickets.filter(
        (t: { user_last_read_at: string | null; updated_at: string }) =>
          !t.user_last_read_at || t.user_last_read_at < t.updated_at
      ).length
    } else {
      // user_last_read_at 컬럼이 없는 경우 → 단순 카운트 폴백
      const { count } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'answered')
      supportBadge = count ?? 0
    }
  } catch {
    // 쿼리 실패 시 뱃지 0으로 처리
  }

  return (
    <DashboardShell
      user={{ email: user.email ?? '', name, initials }}
      supportBadge={supportBadge}
      isAdmin={isAdmin}
    >
      {children}
    </DashboardShell>
  )
}
