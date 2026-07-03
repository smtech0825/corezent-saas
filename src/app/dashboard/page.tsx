/**
 * @파일: dashboard/page.tsx
 * @설명: 대시보드 개요 — 구독 현황(제품명+주기+시작일), 라이선스, 최근 주문
 */

import { createClient } from '@/lib/supabase/server'
import { Key, CreditCard, Package, ArrowRight } from 'lucide-react'
import { formatKRW } from '@/lib/money'
import Link from 'next/link'
import OnboardingChecklist from './OnboardingChecklist'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '대시보드',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ count: licenseCount }, { data: subscriptions }, { data: orders }, { count: downloadedCount }] = await Promise.all([
    supabase
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('subscriptions')
      .select('id, status, billing_interval, current_period_start, current_period_end, product_price_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('orders')
      .select('id, amount, status, created_at, product_price_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    // 온보딩 ① 다운로드 자동 판정 — 다운로드 기록(last_downloaded_version)이 있는 라이선스 수
    supabase
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('last_downloaded_version', 'is', null),
  ])

  // product_price_id로 제품명 조회
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
      priceNameMap.set(pp.id, pp.products?.name ?? 'CoreZent 제품')
    })
  }

  const name = user.user_metadata?.name ?? user.email?.split('@')[0] ?? '회원'

  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-serif text-ink">{name}님, 다시 오신 것을 환영합니다 👋</h1>
        <p className="text-ink-soft text-sm mt-1">계정 현황을 확인하세요.</p>
      </div>

      {/* 온보딩 체크리스트 (구매 회원 · 닫기 전까지) */}
      <OnboardingChecklist
        hasLicense={(licenseCount ?? 0) > 0}
        hasDownloaded={(downloadedCount ?? 0) > 0}
      />

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<Key size={18} className="text-mark" />}
          label="전체 라이선스"
          value={String(licenseCount ?? 0)}
          href="/dashboard/licenses"
        />
        <StatCard
          icon={<Package size={18} className="text-mark" />}
          label="활성 구독"
          value={String(subscriptions?.length ?? 0)}
          href="/dashboard/billing"
        />
        <StatCard
          icon={<CreditCard size={18} className="text-mark" />}
          label="전체 주문"
          value={String(orders?.length ?? 0)}
          href="/dashboard/billing"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 활성 구독 */}
        <Section title="활성 구독" href="/dashboard/billing">
          {subscriptions && subscriptions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {subscriptions.map((sub: any) => (
                <div key={sub.id} className="flex items-start justify-between gap-3 py-3 border-b border-rule last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-ink font-medium truncate">
                      {priceNameMap.get(sub.product_price_id) ?? '알 수 없음'}
                    </p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {sub.billing_interval === 'annual' ? '연간' : '월간'} 플랜
                    </p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      시작일 {fmtDate(sub.current_period_start)}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-ok-soft text-ok border border-ok/20 shrink-0">
                    활성
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="활성 구독이 없습니다." cta="제품 둘러보기" href="/pricing" />
          )}
        </Section>

        {/* 최근 주문 */}
        <Section title="최근 주문" href="/dashboard/billing">
          {orders && orders.length > 0 ? (
            <div className="flex flex-col gap-3">
              {orders.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between py-3 border-b border-rule last:border-0">
                  <div>
                    <p className="text-sm text-ink font-medium">{priceNameMap.get(order.product_price_id) ?? '주문'}</p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {fmtDate(order.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-ink">{formatKRW(order.amount)}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="아직 주문이 없습니다." cta="제품 둘러보기" href="/pricing" />
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
    <Link href={href} className="group bg-paper-raised border border-rule hover:border-mark/40 rounded-xl p-5 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-paper border border-rule flex items-center justify-center">
          {icon}
        </div>
        <ArrowRight size={14} className="text-ink-faint group-hover:text-mark transition-colors" />
      </div>
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-soft mt-1">{label}</p>
    </Link>
  )
}

function Section({ title, href, children }: {
  title: string
  href: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-paper-raised border border-rule rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Link href={href} className="text-xs text-mark hover:underline">전체 보기</Link>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message, cta, href }: { message: string; cta: string; href: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-ink-soft mb-3">{message}</p>
      <Link href={href} className="text-xs text-mark hover:underline">{cta} →</Link>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:      'text-ok bg-ok-soft border-ok/20',
    pending:   'text-caution bg-caution-soft border-caution/20',
    failed:    'text-danger bg-danger-soft border-danger/20',
    refunded:  'text-info bg-info-soft border-info/20',
  }
  const labelMap: Record<string, string> = {
    paid: '결제 완료', pending: '대기 중', failed: '실패', refunded: '환불됨',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${map[status] ?? map.pending}`}>
      {labelMap[status] ?? status}
    </span>
  )
}
