/**
 * @파일: admin/layout.tsx
 * @설명: 관리자 패널 공통 레이아웃 — admin 역할 확인 + 미읽음 지원 티켓 뱃지
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminShell from './_components/AdminShell'

// 설명 문구는 여기 한 곳에만 둔다 — 관리자 화면은 저마다 제목만 정하고 설명은 이것을 물려받는다.
// (이게 없으면 홈 화면 소개 문구가 관리자 화면에까지 따라붙는다)
export const metadata = {
  title: '관리자 패널',
  description: 'CoreZent 운영자 전용 화면입니다. 주문·라이선스·제품·고객지원을 관리합니다.',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/admin')

  // service role key로 RLS 우회하여 role 조회
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const name = profile?.name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? '관리자'
  const initials = name[0].toUpperCase()

  // 미읽음 티켓 수 (관리자 기준: is_read=false)
  const { count: supportBadge } = await adminClient
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)

  return (
    <AdminShell
      user={{ email: user.email ?? '', name, initials }}
      supportBadge={supportBadge ?? 0}
    >
      {children}
    </AdminShell>
  )
}
