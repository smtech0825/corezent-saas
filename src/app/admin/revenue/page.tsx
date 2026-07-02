/**
 * @파일: admin/revenue/page.tsx
 * @설명: 관리자 매출 리포트 — 기존 orders/subscriptions로 산출 가능한 핵심 지표.
 *        총매출·주문수·환불·활성구독·MRR(추정)·해지율 + 월별 매출 추이 + 상품별 매출.
 *        금액은 모두 lib/money.formatKRW(cents ÷100 + ₩), 합산은 정수 cents로.
 *        차트는 무의존 CSS 막대(과설계 방지, 새 집계 테이블 없음).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { formatKRW } from '@/lib/money'
import { TrendingUp, ShoppingBag, RotateCcw, Repeat, Percent } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = { title: '매출 리포트' }

export default async function RevenuePage() {
  const admin = createAdminClient()

  // PostgREST 기본 1000행 상한을 넘겨도 정확히 집계하도록 range로 전량 수집(과소집계 방지).
  async function fetchAll<T>(
    make: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  ): Promise<T[]> {
    const PAGE = 1000
    const out: T[] = []
    for (let from = 0; ; from += PAGE) {
      const { data } = await make(from, from + PAGE - 1)
      const rows = (data ?? []) as T[]
      out.push(...rows)
      if (rows.length < PAGE) break
    }
    return out
  }

  type PaidRow = { id: string; amount: number; created_at: string; product_price_id: string | null }
  type RefundRow = { amount: number }
  type SubRow = { status: string; billing_interval: string | null; order_id: string | null }

  const [paid, refunded, subs] = await Promise.all([
    fetchAll<PaidRow>((f, t) => admin.from('orders').select('id, amount, created_at, product_price_id').eq('status', 'paid').order('created_at', { ascending: false }).range(f, t)),
    fetchAll<RefundRow>((f, t) => admin.from('orders').select('amount').eq('status', 'refunded').order('created_at', { ascending: false }).range(f, t)),
    fetchAll<SubRow>((f, t) => admin.from('subscriptions').select('status, billing_interval, order_id').order('created_at', { ascending: false }).range(f, t)),
  ])

  // 상품명 매핑 (product_price_id → products.name)
  const priceIds = [...new Set(paid.map((o) => o.product_price_id).filter(Boolean))] as string[]
  const priceNameMap = new Map<string, string>()
  if (priceIds.length > 0) {
    const { data: prices } = await admin.from('product_prices').select('id, products(name)').in('id', priceIds)
    ;(prices ?? []).forEach((pp) => {
      const row = pp as unknown as { id: string; products: { name: string } | null }
      priceNameMap.set(row.id, row.products?.name ?? '기타')
    })
  }

  // ── 핵심 집계 (정수 cents) ─────────────────────────────────────
  const totalRevenue = paid.reduce((s, o) => s + (o.amount ?? 0), 0)
  const orderCount = paid.length
  const refundTotal = refunded.reduce((s, o) => s + (o.amount ?? 0), 0)
  const refundCount = refunded.length

  // ── 월별 매출 추이 (최근 12개월, UTC) ──────────────────────────
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, k) => {
    const i = 11 - k
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    return { key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: `${d.getUTCMonth() + 1}월`, cents: 0 }
  })
  const monthIdx = new Map(months.map((m, i) => [m.key, i]))
  paid.forEach((o) => {
    const d = new Date(o.created_at)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const idx = monthIdx.get(key)
    if (idx !== undefined) months[idx].cents += o.amount ?? 0
  })
  const monthMax = Math.max(1, ...months.map((m) => m.cents))

  // ── 상품별 매출 ────────────────────────────────────────────────
  const prodMap = new Map<string, number>()
  paid.forEach((o) => {
    const name = o.product_price_id ? (priceNameMap.get(o.product_price_id) ?? '기타') : '기타'
    prodMap.set(name, (prodMap.get(name) ?? 0) + (o.amount ?? 0))
  })
  const products = [...prodMap.entries()].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents)
  const prodMax = Math.max(1, ...products.map((p) => p.cents))

  // ── 구독 지표 ──────────────────────────────────────────────────
  const activeSubs = subs.filter((s) => s.status === 'active').length
  const totalSubs = subs.length
  const endedSubs = subs.filter((s) => s.status === 'cancelled' || s.status === 'expired').length
  const churnRate = totalSubs > 0 ? Math.round((endedSubs / totalSubs) * 1000) / 10 : 0

  // MRR(추정): 활성 구독의 연결 주문금액을 월 단위로 환산(연간=÷12). 정수 cents 합산.
  const orderAmount = new Map(paid.map((o) => [o.id, o.amount ?? 0]))
  let mrrCents = 0
  subs.filter((s) => s.status === 'active').forEach((s) => {
    const amt = s.order_id ? (orderAmount.get(s.order_id) ?? 0) : 0
    mrrCents += s.billing_interval === 'annual' ? amt / 12 : amt
  })
  mrrCents = Math.round(mrrCents)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">매출 리포트</h1>
        <p className="text-sm text-[#E2E8F0] mt-1">결제 완료 주문 기준의 핵심 매출 지표입니다.</p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi icon={<TrendingUp size={16} className="text-emerald-400" />} label="총매출 (결제 완료)" value={formatKRW(totalRevenue)} />
        <Kpi icon={<ShoppingBag size={16} className="text-[#38BDF8]" />} label="총 주문수" value={orderCount.toLocaleString('ko-KR')} />
        <Kpi icon={<RotateCcw size={16} className="text-red-400" />} label="환불 총액" value={formatKRW(refundTotal)} sub={`${refundCount}건`} />
        <Kpi icon={<Repeat size={16} className="text-violet-400" />} label="활성 구독" value={activeSubs.toLocaleString('ko-KR')} />
        <Kpi icon={<TrendingUp size={16} className="text-emerald-400" />} label="MRR (추정)" value={formatKRW(mrrCents)} sub="월 환산" />
        <Kpi icon={<Percent size={16} className="text-amber-400" />} label="해지율" value={`${churnRate}%`} sub={`${endedSubs}/${totalSubs} 구독`} />
      </div>

      {/* 월별 매출 추이 */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">월별 매출 추이 (최근 12개월)</h2>
        <div className="flex items-end gap-1.5 h-40">
          {months.map((m) => (
            <div key={m.key} className="flex-1 h-full flex items-end" title={`${m.label} · ${formatKRW(m.cents)}`}>
              <div
                className="w-full bg-[#38BDF8]/80 hover:bg-[#38BDF8] rounded-t transition-colors"
                style={{ height: `${Math.max((m.cents / monthMax) * 100, 2)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {months.map((m) => (
            <span key={m.key} className="flex-1 text-center text-[9px] text-[#94A3B8]">{m.label}</span>
          ))}
        </div>
      </section>

      {/* 상품별 매출 */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">상품별 매출</h2>
        {products.length === 0 ? (
          <p className="text-sm text-[#94A3B8] py-2">매출 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#E2E8F0] truncate max-w-[60%]">{p.name}</span>
                  <span className="text-xs font-semibold text-white tabular-nums">{formatKRW(p.cents)}</span>
                </div>
                <div className="h-2.5 bg-[#1E293B] rounded-full overflow-hidden">
                  <div className="h-full bg-[#38BDF8] rounded-full" style={{ width: `${Math.max((p.cents / prodMax) * 100, 3)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** KPI 카드 */
function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5">
      <div className="w-9 h-9 rounded-lg bg-[#0B1120] border border-[#1E293B] flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-[#E2E8F0] mt-1">{label}{sub && <span className="text-[#94A3B8]"> · {sub}</span>}</p>
    </div>
  )
}
