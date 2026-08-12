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
import PageContainer from '@/components/common/PageContainer'
import StatCard from '@/components/common/StatCard'
import EmptyState from '@/components/common/EmptyState'

/**
 * @함수명: fmtCompact
 * @설명: 차트 막대 위에 얹는 축약 표기(만·억 단위). 좁은 막대 위에 전체 금액을 쓰면
 *        서로 겹쳐 읽을 수 없어 축약한다. 정확한 값은 Y축 눈금과 막대 툴팁(formatKRW)에 있다.
 * @매개변수: cents - 정수 센트 금액
 * @반환값: "123만" 형태의 축약 문자열
 */
function fmtCompact(cents: number): string {
  return new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(cents / 100))
}

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
    <PageContainer variant="admin" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">매출 리포트</h1>
        <p className="text-sm text-ink-soft mt-1">결제 완료 주문 기준의 핵심 매출 지표입니다.</p>
      </div>

      {/* KPI 카드 — 공용 StatCard. 6장이 3열×2줄로 헐렁하게 퍼지던 것을
          넓은 화면에서 열 수를 늘려 카드 폭과 내용을 맞춘다.
          (xl 6열은 사이드바를 뺀 본문 폭에서 금액이 카드를 넘칠 수 있어 4열,
          6열은 2xl부터 — 검증에서 발견된 겹침 방지) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 items-start">
        <StatCard icon={<TrendingUp size={16} className="text-mark" />} label="총매출 (결제 완료)" value={formatKRW(totalRevenue)} />
        <StatCard icon={<ShoppingBag size={16} className="text-mark" />} label="총 주문수" value={orderCount.toLocaleString('ko-KR')} />
        <StatCard icon={<RotateCcw size={16} className="text-mark" />} label="환불 총액" value={formatKRW(refundTotal)} subline={`${refundCount}건`} />
        <StatCard icon={<Repeat size={16} className="text-mark" />} label="활성 구독" value={activeSubs.toLocaleString('ko-KR')} />
        <StatCard icon={<TrendingUp size={16} className="text-mark" />} label="MRR (추정)" value={formatKRW(mrrCents)} subline="월 환산" />
        <StatCard icon={<Percent size={16} className="text-mark" />} label="해지율" value={`${churnRate}%`} subline={`${endedSubs}/${totalSubs} 구독`} />
      </div>

      {/* 월별 매출 추이 — 데이터가 없으면 차트를 그리지 않는다.
          예전에는 0원인 달에도 최소 높이 막대(바닥 선분 12개)가 그려져
          값이 있는 것처럼 보였다. 이제 0원인 달은 막대가 아예 없다. */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">월별 매출 추이 (최근 12개월)</h2>
        {months.every((m) => m.cents === 0) ? (
          <EmptyState message="아직 매출 데이터가 없습니다" />
        ) : (
          <div className="flex gap-3">
            {/* Y축 눈금 — 최대·절반·0 (실제 집계값의 표기, 만든 숫자 아님) */}
            <div className="h-40 flex flex-col justify-between items-end shrink-0 text-[9px] text-ink-faint tabular-nums">
              <span>{formatKRW(monthMax)}</span>
              <span>{formatKRW(Math.round(monthMax / 2))}</span>
              <span>₩0</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-end gap-1.5 h-40 border-l border-b border-rule pl-1.5">
                {months.map((m) => (
                  <div
                    key={m.key}
                    className="flex-1 h-full flex flex-col justify-end items-center"
                    title={`${m.label} · ${formatKRW(m.cents)}`}
                  >
                    {m.cents > 0 && (
                      <>
                        <span className="shrink-0 text-[9px] text-ink-faint tabular-nums mb-0.5 truncate max-w-full">
                          {fmtCompact(m.cents)}
                        </span>
                        {/* 라벨 높이(16px)를 미리 빼고 전 막대를 같은 비율로 그린다.
                            라벨과 막대를 그냥 쌓으면 flex가 최댓값 막대만 눌러
                            상위 값들이 같은 높이로 뭉개진다(검증에서 발견). */}
                        <div
                          className="w-full shrink-0 bg-mark/80 hover:bg-mark rounded-t transition-colors"
                          style={{ height: `max(calc((100% - 16px) * ${(m.cents / monthMax).toFixed(4)}), 3px)` }}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mt-1.5 pl-1.5">
                {months.map((m) => (
                  <span key={m.key} className="flex-1 text-center text-[9px] text-ink-faint">{m.label}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 상품별 매출 */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">상품별 매출</h2>
        {products.length === 0 ? (
          <EmptyState message="매출 데이터가 없습니다." />
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-ink-soft truncate max-w-[60%]">{p.name}</span>
                  <span className="text-xs font-semibold text-ink tabular-nums">{formatKRW(p.cents)}</span>
                </div>
                <div className="h-2.5 bg-paper-shade rounded-full overflow-hidden">
                  <div className="h-full bg-mark rounded-full" style={{ width: `${Math.max((p.cents / prodMax) * 100, 3)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  )
}

// KPI 카드는 공용 StatCard(components/common/StatCard.tsx)를 쓴다.
