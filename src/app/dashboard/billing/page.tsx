/**
 * @파일: dashboard/billing/page.tsx
 * @설명: 결제 내역 및 구독 관리 — 각각 5개/페이지 독립 페이지네이션
 *        구독 항목에 Download 버튼 + "New" 배지 포함
 */

import { createClient } from '@/lib/supabase/server'
import { CreditCard, Package } from 'lucide-react'
import Link from 'next/link'
import Pagination from '@/components/common/Pagination'
import BillingSubscriptionSection, { type SubRow } from './BillingSubscriptionSection'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Billing — CoreZent',
}

const SUB_PAGE_SIZE = 5
const ORD_PAGE_SIZE = 5

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ subPage?: string; ordPage?: string }>
}) {
  const { subPage: subPageStr, ordPage: ordPageStr } = await searchParams
  const subPage = Math.max(1, parseInt(subPageStr ?? '1', 10))
  const ordPage = Math.max(1, parseInt(ordPageStr ?? '1', 10))
  const subOffset = (subPage - 1) * SUB_PAGE_SIZE
  const ordOffset = (ordPage - 1) * ORD_PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: subscriptions, count: subTotal }, { data: orders, count: ordTotal }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('id, status, billing_interval, current_period_end, cancel_at_period_end, customer_portal_url, product_price_id', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(subOffset, subOffset + SUB_PAGE_SIZE - 1),
    supabase
      .from('orders')
      .select('id, amount, status, created_at, product_price_id', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(ordOffset, ordOffset + ORD_PAGE_SIZE - 1),
  ])

  // product_price_id 목록으로 제품 정보 조회
  const priceIds = [...new Set([
    ...(subscriptions ?? []).map((s: any) => s.product_price_id),
    ...(orders ?? []).map((o: any) => o.product_price_id),
  ].filter(Boolean))]

  const priceNameMap    = new Map<string, string>()
  const priceManualMap  = new Map<string, string | null>()
  const priceProductMap = new Map<string, string>()  // priceId → productId

  if (priceIds.length > 0) {
    const { data: prices } = await supabase
      .from('product_prices')
      .select('id, products(id, name, manual_url)')
      .in('id', priceIds)
    ;(prices ?? []).forEach((pp: any) => {
      priceNameMap.set(pp.id, pp.products?.name ?? 'CoreZent Product')
      priceManualMap.set(pp.id, pp.products?.manual_url ?? null)
      if (pp.products?.id) priceProductMap.set(pp.id, pp.products.id)
    })
  }

  // 구독 상품의 product_id 목록 → 최신 changelog + 사용자 라이선스 조회
  const subProductIds = [...new Set(
    (subscriptions ?? []).map((s: any) => priceProductMap.get(s.product_price_id)).filter(Boolean)
  )] as string[]

  const changelogMap = new Map<string, { version: string; download_urls: Record<string, string> }>()
  const licenseVersionMap = new Map<string, string | null>()  // productId → last_downloaded_version

  if (subProductIds.length > 0) {
    const [{ data: latestChangelogs }, { data: userLicenses }] = await Promise.all([
      supabase
        .from('changelogs')
        .select('product_id, version, download_urls')
        .in('product_id', subProductIds)
        .eq('is_latest', true),
      supabase
        .from('licenses')
        .select('product_id, last_downloaded_version')
        .eq('user_id', user.id)
        .in('product_id', subProductIds),
    ])

    ;(latestChangelogs ?? []).forEach((c: any) => {
      changelogMap.set(c.product_id, {
        version:       c.version,
        download_urls: (c.download_urls ?? {}) as Record<string, string>,
      })
    })
    ;(userLicenses ?? []).forEach((l: any) => {
      licenseVersionMap.set(l.product_id, l.last_downloaded_version ?? null)
    })
  }

  // 현재 페이지 파라미터를 유지하며 href 생성
  function subHref(p: number) {
    return `/dashboard/billing?subPage=${p}&ordPage=${ordPage}`
  }
  function ordHref(p: number) {
    return `/dashboard/billing?subPage=${subPage}&ordPage=${p}`
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-[#94A3B8] text-sm mt-1">Manage subscriptions and view payment history.</p>
      </div>

      {/* 구독 섹션 */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-4">
          Subscriptions
          {(subTotal ?? 0) > 0 && <span className="ml-2 normal-case text-[#475569] font-normal">({subTotal} total)</span>}
        </h2>
        {subscriptions && subscriptions.length > 0 ? (
          <>
            <BillingSubscriptionSection
              rows={(subscriptions as any[]).map((sub): SubRow => {
                const productId   = priceProductMap.get(sub.product_price_id)
                const changelog   = productId ? changelogMap.get(productId) : undefined
                const lastVer     = productId ? licenseVersionMap.get(productId) : undefined
                const isNew       = !!changelog && (lastVer == null || lastVer !== changelog.version)
                const hasDownload = !!changelog && Object.values(changelog.download_urls).some(Boolean)
                return {
                  id:               sub.id,
                  productId,
                  productName:      priceNameMap.get(sub.product_price_id) ?? 'Unknown',
                  billingInterval:  sub.billing_interval,
                  currentPeriodEnd: sub.current_period_end ?? null,
                  status:           sub.status,
                  manualUrl:        priceManualMap.get(sub.product_price_id) ?? null,
                  changelog,
                  isNew,
                  hasDownload,
                }
              })}
            />
            <Pagination page={subPage} total={subTotal ?? 0} pageSize={SUB_PAGE_SIZE} buildHref={subHref} />
          </>
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
        <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-4">
          Payment History
          {(ordTotal ?? 0) > 0 && <span className="ml-2 normal-case text-[#475569] font-normal">({ordTotal} total)</span>}
        </h2>
        {orders && orders.length > 0 ? (
          <>
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
            <Pagination page={ordPage} total={ordTotal ?? 0} pageSize={ORD_PAGE_SIZE} buildHref={ordHref} />
          </>
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
