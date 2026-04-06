/**
 * @파일: admin/layout.tsx
 * @설명: 관리자 패널 공통 레이아웃 — admin 역할 확인 후 쉘 구성
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminShell from './_components/AdminShell'

export const metadata = {
  title: 'Admin Panel — CoreZent',
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

  const name = profile?.name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Admin'
  const initials = name[0].toUpperCase()

  return (
    <AdminShell user={{ email: user.email ?? '', name, initials }}>
      {children}
    </AdminShell>
  )
}
