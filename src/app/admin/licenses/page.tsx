/**
 * @파일: admin/licenses/page.tsx
 * @설명: 관리자 라이선스 관리 — 발급된 모든 라이선스 목록 및 상태 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function maskKey(key: string) {
  const parts = key.split('-')
  if (parts.length !== 4) return key
  return `${parts[0]}-****-****-${parts[3]}`
}

const statusColors: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-400/10',
  inactive: 'text-[#475569] bg-[#1E293B]',
  revoked: 'text-red-400 bg-red-400/10',
  expired: 'text-amber-400 bg-amber-400/10',
}

async function revokeKey(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  if (!id) return
  const adminClient = createAdminClient()
  await adminClient.from('licenses').update({ status: 'revoked' }).eq('id', id)
  revalidatePath('/admin/licenses')
}

async function activateKey(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  if (!id) return
  const adminClient = createAdminClient()
  await adminClient.from('licenses').update({ status: 'active' }).eq('id', id)
  revalidatePath('/admin/licenses')
}

export default async function LicensesPage() {
  const adminClient = createAdminClient()

  const { data: licenses } = await adminClient
    .from('licenses')
    .select('id, user_id, serial_key, status, max_devices, expires_at, created_at')
    .order('created_at', { ascending: false })

  let emailMap: Map<string, string> = new Map()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 무시 */ }

  const list = (licenses ?? []).map((l) => ({
    ...l,
    email: emailMap.get(l.user_id) ?? '—',
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Licenses</h1>
        <p className="text-sm text-[#94A3B8] mt-1">{list.length} total licenses</p>
      </div>

      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        {list.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#475569]">No licenses issued yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  <th className="text-left px-6 py-3 text-xs text-[#475569] font-medium">Serial Key</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">User</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Max Devices</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Expires</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => (
                  <tr key={l.id} className="border-b border-[#1E293B]/50 hover:bg-[#0B1120]/40 transition-colors">
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs text-[#94A3B8]">{maskKey(l.serial_key)}</span>
                    </td>
                    <td className="px-4 py-3 text-[#94A3B8] truncate max-w-[180px]">{l.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${statusColors[l.status] ?? 'text-[#94A3B8] bg-[#1E293B]'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{l.max_devices}</td>
                    <td className="px-4 py-3 text-[#475569] whitespace-nowrap">{fmtDate(l.expires_at)}</td>
                    <td className="px-4 py-3">
                      {l.status === 'active' ? (
                        <form action={revokeKey}>
                          <input type="hidden" name="id" value={l.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 px-2 py-1 rounded-lg transition-colors"
                          >
                            Revoke
                          </button>
                        </form>
                      ) : l.status === 'revoked' ? (
                        <form action={activateKey}>
                          <input type="hidden" name="id" value={l.id} />
                          <button
                            type="submit"
                            className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-400/20 hover:border-emerald-400/40 px-2 py-1 rounded-lg transition-colors"
                          >
                            Restore
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-[#475569]">—</span>
                      )}
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
