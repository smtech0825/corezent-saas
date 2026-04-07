/**
 * @파일: admin/orders/page.tsx
 * @설명: 관리자 주문 관리 — 전체 주문 목록 및 상태 확인
 */

import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const statusColors: Record<string, string> = {
  paid: 'text-emerald-400 bg-emerald-400/10',
  pending: 'text-amber-400 bg-amber-400/10',
  refunded: 'text-blue-400 bg-blue-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
}

export default async function OrdersPage() {
  const adminClient = createAdminClient()

  const { data: orders } = await adminClient
    .from('orders')
    .select('id, user_id, amount, status, created_at')
    .order('created_at', { ascending: false })

  let emailMap: Map<string, string> = new Map()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 무시 */ }

  const list = (orders ?? []).map((o) => ({
    ...o,
    email: emailMap.get(o.user_id) ?? '—',
    shortId: o.id.slice(0, 8).toUpperCase(),
  }))

  const totalRevenue = list.filter((o) => o.status === 'paid').reduce((s, o) => s + (o.amount ?? 0), 0) / 100

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{list.length} total orders</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#475569]">Total Revenue</p>
          <p className="text-lg font-bold text-emerald-400">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalRevenue)}
          </p>
        </div>
      </div>

      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        {list.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#475569]">No orders yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  <th className="text-left px-6 py-3 text-xs text-[#475569] font-medium">Order ID</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Customer</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id} className="border-b border-[#1E293B]/50 hover:bg-[#0B1120]/40 transition-colors">
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs text-[#94A3B8]">#{o.shortId}</span>
                    </td>
                    <td className="px-4 py-3 text-[#94A3B8] truncate max-w-[200px]">{o.email}</td>
                    <td className="px-4 py-3 text-white font-medium">{fmtCurrency((o.amount ?? 0) / 100)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${statusColors[o.status] ?? 'text-[#94A3B8] bg-[#1E293B]'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#475569] whitespace-nowrap">{fmtDate(o.created_at)}</td>
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
