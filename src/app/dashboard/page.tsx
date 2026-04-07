/**
 * @파일: dashboard/page.tsx
 * @설명: 대시보드 개요 — 구독 현황, 라이선스, 최근 주문
 */

import { createClient } from '@/lib/supabase/server'
import { Key, CreditCard, Package, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Dashboard — CoreZent',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 라이선스 수
  const { count: licenseCount } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // 활성 구독
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*, product_prices(products(name))')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(3)

  // 최근 주문
  const { data: orders } = await supabase
    .from('orders')
    .select('id, amount, status, created_at, product_prices(products(name))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const name = user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'there'

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Welcome back, {name} 👋</h1>
        <p className="text-[#94A3B8] text-sm mt-1">Here&apos;s what&apos;s happening with your account.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<Key size={18} className="text-[#38BDF8]" />}
          label="Total Licenses"
          value={String(licenseCount ?? 0)}
          href="/dashboard/licenses"
        />
        <StatCard
          icon={<Package size={18} className="text-emerald-400" />}
          label="Active Subscriptions"
          value={String(subscriptions?.length ?? 0)}
          href="/dashboard/billing"
        />
        <StatCard
          icon={<CreditCard size={18} className="text-violet-400" />}
          label="Total Orders"
          value={String(orders?.length ?? 0)}
          href="/dashboard/billing"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 활성 구독 */}
        <Section title="Active Subscriptions" href="/dashboard/billing">
          {subscriptions && subscriptions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {subscriptions.map((sub: any) => (
                <div key={sub.id} className="flex items-center justify-between py-3 border-b border-[#1E293B] last:border-0">
                  <div>
                    <p className="text-sm text-white font-medium">{(sub.product_prices as any)?.products?.name ?? 'Unknown'}</p>
                    <p className="text-xs text-[#475569] mt-0.5">
                      Renews {sub.current_period_end
                        ? new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No active subscriptions." cta="Browse products" href="/pricing" />
          )}
        </Section>

        {/* 최근 주문 */}
        <Section title="Recent Orders" href="/dashboard/billing">
          {orders && orders.length > 0 ? (
            <div className="flex flex-col gap-3">
              {orders.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between py-3 border-b border-[#1E293B] last:border-0">
                  <div>
                    <p className="text-sm text-white font-medium">{(order.product_prices as any)?.products?.name ?? 'Order'}</p>
                    <p className="text-xs text-[#475569] mt-0.5">
                      {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white">${((order.amount ?? 0) / 100).toFixed(2)}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No orders yet." cta="Browse products" href="/pricing" />
          )}
        </Section>
      </div>
    </div>
  )
}

// ─── 서브 컴포넌트 ───────────────────────────────────────────

function StatCard({ icon, label, value, href }: {
  icon: React.ReactNode
  label: string
  value: string
  href: string
}) {
  return (
    <Link href={href} className="group bg-[#111A2E] border border-[#1E293B] hover:border-[#38BDF8]/30 rounded-xl p-5 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-[#0B1120] border border-[#1E293B] flex items-center justify-center">
          {icon}
        </div>
        <ArrowRight size={14} className="text-[#475569] group-hover:text-[#38BDF8] transition-colors" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-[#94A3B8] mt-1">{label}</p>
    </Link>
  )
}

function Section({ title, href, children }: {
  title: string
  href: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-[#111A2E] border border-[#1E293B] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <Link href={href} className="text-xs text-[#38BDF8] hover:underline">View all</Link>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message, cta, href }: { message: string; cta: string; href: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-[#475569] mb-3">{message}</p>
      <Link href={href} className="text-xs text-[#38BDF8] hover:underline">{cta} →</Link>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    failed: 'text-red-400 bg-red-500/10 border-red-500/20',
    refunded: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${map[status] ?? map.pending}`}>
      {status}
    </span>
  )
}
