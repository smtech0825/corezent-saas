/**
 * @파일: dashboard/billing/page.tsx
 * @설명: 결제 내역 및 구독 관리 페이지
 */

import { createClient } from '@/lib/supabase/server'
import { CreditCard, Package, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Billing — CoreZent',
}

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 조인 없이 단순 쿼리
  const [{ data: subscriptions }, { data: orders }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('id, status, billing_interval, current_period_end, cancel_at_period_end, customer_portal_url, product_price_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id, amount, status, created_at, product_price_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // product_price_id 목록으로 제품명 조회
  const priceIds = [...new Set([
    ...(subscriptions ?? []).map((s: any) => s.product_price_id),
    ...(orders ?? []).map((o: any) => o.product_price_id),
  ].filter(Boolean))]

  const priceNameMap = new Map<string, string>()
  if (priceIds.length > 0) {
    const { data: prices } = await supabase
      .from('product_prices')
      .select('id, products(name)')
      .in('id', priceIds)
    ;(prices ?? []).forEach((pp: any) => {
      priceNameMap.set(pp.id, pp.products?.name ?? 'CoreZent Product')
    })
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-[#94A3B8] text-sm mt-1">Manage subscriptions and view payment history.</p>
      </div>

      {/* 구독 섹션 */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-4">Subscriptions</h2>
        {subscriptions && subscriptions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {subscriptions.map((sub: any) => (
              <div key={sub.id} className="bg-[#111A2E] border border-[#1E293B] rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#0B1120] border border-[#1E293B] flex items-center justify-center shrink-0">
                    <Package size={18} className="text-[#38BDF8]" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{priceNameMap.get(sub.product_price_id) ?? 'Unknown'}</p>
                    <p className="text-xs text-[#475569] mt-0.5">
                      {sub.billing_interval === 'annual' ? 'Annual' : 'Monthly'} plan
                      {sub.current_period_end && ` · Renews ${new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <SubStatusBadge status={sub.status} />
                  <Link
                    href="/dashboard/licenses"
                    className="inline-flex items-center gap-1.5 text-xs text-[#38BDF8] hover:text-white border border-[#38BDF8]/30 hover:border-[#38BDF8]/60 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ExternalLink size={11} />
                    Check License
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyCard
            icon={<Package size={20} className="text-[#475569]" />}
            message="No subscriptions yet."
            action={<Link href="/pricing" className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#38BDF8] hover:underline">Browse plans →</Link>}
          />
        )}
      </section>

      {/* 결제 내역 섹션 */}
      <section>
        <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-4">Payment History</h2>
        {orders && orders.length > 0 ? (
          <div className="bg-[#111A2E] border border-[#1E293B] rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_160px_120px_100px] gap-4 px-5 py-3 border-b border-[#1E293B] text-xs text-[#475569] font-medium">
              <span>Product</span>
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {orders.map((order: any) => (
              <div
                key={order.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_160px_120px_100px] gap-2 md:gap-4 items-center px-5 py-4 border-b border-[#1E293B] last:border-0 hover:bg-[#1E293B]/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CreditCard size={14} className="text-[#475569] shrink-0 hidden md:block" />
                  <span className="text-sm text-white">{priceNameMap.get(order.product_price_id) ?? 'Order'}</span>
                </div>
                <span className="text-sm text-[#94A3B8]">
                  {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-sm text-white font-medium">
                  ${((order.amount ?? 0) / 100).toFixed(2)}
                </span>
                <OrderStatusBadge status={order.status} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyCard icon={<CreditCard size={20} className="text-[#475569]" />} message="No payment history yet." />
        )}
      </section>
    </div>
  )
}

// ─── 서브 컴포넌트 ───────────────────────────────────────────

function EmptyCard({ icon, message, action }: { icon: React.ReactNode; message: string; action?: React.ReactNode }) {
  return (
    <div className="bg-[#111A2E] border border-[#1E293B] rounded-xl py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="text-sm text-[#475569]">{message}</p>
      {action}
    </div>
  )
}

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, { style: string; label: string }> = {
    active:    { style: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'active' },
    paused:    { style: 'text-amber-400 bg-amber-500/10 border-amber-500/20',       label: 'paused' },
    cancelled: { style: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]',            label: 'cancelled' },
    expired:   { style: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]',            label: 'cancelled' },
  }
  const { style, label } = map[status] ?? map.cancelled
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${style}`}>
      {label}
    </span>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    pending:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
    failed:    'text-red-400 bg-red-500/10 border-red-500/20',
    refunded:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
    cancelled: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]',
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium text-center ${map[status] ?? map.pending}`}>
      {status}
    </span>
  )
}
