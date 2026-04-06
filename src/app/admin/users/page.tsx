/**
 * @파일: admin/users/page.tsx
 * @설명: 관리자 사용자 관리 — 전체 사용자 목록, 역할 변경
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { Shield, User } from 'lucide-react'
import RoleSelect from './RoleSelect'

export const dynamic = 'force-dynamic'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function changeRole(userId: string, newRole: string) {
  'use server'
  if (!userId || !newRole) return
  const adminClient = createAdminClient()
  await adminClient.from('profiles').update({ role: newRole }).eq('id', userId)
  revalidatePath('/admin/users')
}

export default async function UsersPage() {
  const adminClient = createAdminClient()

  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, name, role, country, created_at')
    .order('created_at', { ascending: false })

  let emailMap: Map<string, string> = new Map()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 무시 */ }

  const users = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? '—',
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-sm text-[#94A3B8] mt-1">{users.length} total users</p>
      </div>

      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        {users.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#475569]">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  <th className="text-left px-6 py-3 text-xs text-[#475569] font-medium">User</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Country</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Joined</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Change Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[#1E293B]/50 hover:bg-[#0B1120]/40 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-xs font-bold text-[#38BDF8] shrink-0">
                          {(u.name ?? '?')[0].toUpperCase()}
                        </span>
                        <span className="text-white font-medium truncate max-w-[120px]">{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#94A3B8] truncate max-w-[180px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full capitalize ${
                        u.role === 'admin'
                          ? 'bg-amber-400/10 text-amber-400'
                          : 'bg-[#1E293B] text-[#94A3B8]'
                      }`}>
                        {u.role === 'admin' ? <Shield size={11} /> : <User size={11} />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{u.country || '—'}</td>
                    <td className="px-4 py-3 text-[#475569] whitespace-nowrap">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <RoleSelect userId={u.id} currentRole={u.role} onChange={changeRole} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
