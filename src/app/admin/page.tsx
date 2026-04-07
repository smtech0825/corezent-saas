/**
 * @파일: admin/page.tsx
 * @설명: 관리자 대시보드 개요 — 핵심 통계 카드 + 최근 주문/가입 테이블
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { Users, DollarSign, Key, MessageSquare, TrendingUp, UserPlus } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const statusColors: Record<string, string> = {
  paid: 'text-emerald-400 bg-emerald-400/10',
  pending: 'text-amber-400 bg-amber-400/10',
  refunded: 'text-blue-400 bg-blue-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
  active: 'text-emerald-400 bg-emerald-400/10',
  open: 'text-amber-400 bg-amber-400/10',
  answered: 'text-blue-400 bg-blue-400/10',
  closed: 'text-[#475569] bg-[#1E293B]',
  admin: 'text-amber-400 bg-amber-400/10',
  user: 'text-[#94A3B8] bg-[#1E293B]',
}

export default async function AdminPage() {
  const adminClient = createAdminClient()

  // 병렬 통계 쿼리
  const [
    userCountRes,
    revenueRes,
    licenseCountRes,
    ticketCountRes,
    recentOrdersRes,
  ] = await Promise.all([
    adminClient.from('profiles').select('*', { count: 'exact', head: true }),
    adminClient.from('orders').select('amount').eq('status', 'paid'),
    adminClient.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    adminClient.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    adminClient
      .from('orders')
      .select('id, amount, status, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const totalUsers = userCountRes.count ?? 0
  const totalRevenue = (revenueRes.data ?? []).reduce((s, o) => s + (o.amount ?? 0), 0) / 100
  const activeLicenses = licenseCountRes.count ?? 0
  const openTickets = ticketCountRes.count ?? 0
  const recentOrders = recentOrdersRes.data ?? []

  // 최근 가입자 (profiles 테이블)
  const { data: recentUsers } = await adminClient
    .from('profiles')
    .select('id, name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  // 주문자 이메일 조회 (auth admin)
  let emailMap: Map<string, string> = new Map()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch {
    // 이메일 조회 실패 시 무시
  }

  const stats = [
    { label: 'Total Users', value: fmt(totalUsers), icon: Users, color: 'text-[#38BDF8]', bg: 'bg-[#38BDF8]/10' },
    { label: 'Total Revenue', value: fmtCurrency(totalRevenue), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Active Licenses', value: fmt(activeLicenses), icon: Key, color: 'text-violet-400', bg: 'bg-violet-400/10' },
    { label: 'Open Tickets', value: fmt(openTickets), icon: MessageSquare, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ]

  return (
    <div className="p-6 space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-sm text-[#94A3B8] mt-1">Welcome back. Here's what's happening.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#94A3B8]">{s.label}</p>
                <span className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <Icon size={17} className={s.color} />
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* 두 컬럼 테이블 */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* 최근 주문 (3/5) */}
        <div className="xl:col-span-3 border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B]">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-[#94A3B8]" />
              <h2 className="text-sm font-semibold text-white">Recent Orders</h2>
            </div>
            <a href="/admin/orders" className="text-xs text-[#38BDF8] hover:underline">View all</a>
          </div>
          {recentOrders.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#475569]">No orders yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E293B]">
                    <th className="text-left px-6 py-3 text-xs text-[#475569] font-medium">User</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Amount</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-[#1E293B]/50 hover:bg-[#0B1120]/40 transition-colors">
                      <td className="px-6 py-3 text-[#94A3B8] truncate max-w-[160px]">
                        {emailMap.get(order.user_id) || '—'}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">
                        {fmtCurrency((order.amount ?? 0) / 100)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColors[order.status] ?? 'text-[#94A3B8] bg-[#1E293B]'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#475569] whitespace-nowrap">
                        {fmtDate(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 최근 가입자 (2/5) */}
        <div className="xl:col-span-2 border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B]">
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-[#94A3B8]" />
              <h2 className="text-sm font-semibold text-white">Recent Signups</h2>
            </div>
            <a href="/admin/users" className="text-xs text-[#38BDF8] hover:underline">View all</a>
          </div>
          {(!recentUsers || recentUsers.length === 0) ? (
            <div className="py-12 text-center text-sm text-[#475569]">No users yet.</div>
          ) : (
            <div className="divide-y divide-[#1E293B]/50">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-6 py-3 hover:bg-[#0B1120]/40 transition-colors">
                  <span className="w-8 h-8 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-xs font-bold text-[#38BDF8] shrink-0">
                    {(u.name ?? '?')[0].toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">{u.name || 'Unknown'}</p>
                    <p className="text-xs text-[#475569]">{fmtDate(u.created_at)}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${statusColors[u.role] ?? 'text-[#94A3B8] bg-[#1E293B]'}`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
