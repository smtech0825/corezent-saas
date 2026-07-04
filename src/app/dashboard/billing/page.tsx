/**
 * @파일: dashboard/billing/page.tsx
 * @설명: 결제 내역 및 구독 관리 — 독립 페이지네이션(구독 15행 표 기준 · 결제 내역 5개)
 *        구독 항목에 Download 버튼 + "New" 배지 포함
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreditCard, Package } from 'lucide-react'
import Link from 'next/link'
import Pagination from '@/components/common/Pagination'
import BillingSubscriptionSection, { type SubRow } from './BillingSubscriptionSection'
import { formatKRW } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '결제',
}

const SUB_PAGE_SIZE = 15  // 구독은 표(행)로 표시 — 한 화면에 더 많은 행
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

  const [{ data: subscriptions, count: subTotal }, { data: orders, count: ordTotal }, { data: pendingDeposits }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('id, order_id, status, billing_interval, current_period_end, cancel_at_period_end, customer_portal_url, product_price_id, lemon_squeezy_subscription_id', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(subOffset, subOffset + SUB_PAGE_SIZE - 1),
    supabase
      .from('orders')
      .select('id, amount, status, created_at, product_price_id', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(ordOffset, ordOffset + ORD_PAGE_SIZE - 1),
    // 입금 대기(계좌이체) 주문 — 안내 재확인용(페이지네이션과 별개로 전체)
    supabase
      .from('orders')
      .select('id, amount, created_at, product_price_id, deposit_expires_at')
      .eq('user_id', user.id)
      .eq('status', 'pending_deposit')
      .order('created_at', { ascending: false }),
  ])

  // 입금 대기 주문이 있으면 계좌 안내(front_settings)를 읽어 재확인 패널에 표시(공개 설정값 — 서버에서 admin으로 조회)
  let bankInfo = { bank: '', accountNumber: '', accountHolder: '' }
  if ((pendingDeposits ?? []).length > 0) {
    const adminC = createAdminClient()
    const { data: bk } = await adminC
      .from('front_settings').select('key, value')
      .in('key', ['bank_transfer_bank', 'bank_transfer_account_number', 'bank_transfer_account_holder'])
    const m = new Map((bk ?? []).map((r) => [r.key, r.value ?? '']))
    bankInfo = {
      bank: m.get('bank_transfer_bank') ?? '',
      accountNumber: m.get('bank_transfer_account_number') ?? '',
      accountHolder: m.get('bank_transfer_account_holder') ?? '',
    }
  }

  // product_price_id 목록으로 제품 정보 조회
  const priceIds = [...new Set([
    ...(subscriptions ?? []).map((s: any) => s.product_price_id),
    ...(orders ?? []).map((o: any) => o.product_price_id),
    ...(pendingDeposits ?? []).map((o: any) => o.product_price_id),
  ].filter(Boolean))]

  const priceNameMap    = new Map<string, string>()
  const priceManualMap  = new Map<string, string | null>()
  const priceProductMap = new Map<string, string>()  // priceId → productId
  const priceOptMap     = new Map<string, string>()  // priceId → "월간 · 1PC용"

  if (priceIds.length > 0) {
    const { data: prices } = await supabase
      .from('product_prices')
      .select('id, option_axis1_label, option_axis2_label, products(id, name, manual_url)')
      .in('id', priceIds)
    ;(prices ?? []).forEach((pp: any) => {
      priceNameMap.set(pp.id, pp.products?.name ?? 'CoreZent 제품')
      priceManualMap.set(pp.id, pp.products?.manual_url ?? null)
      if (pp.products?.id) priceProductMap.set(pp.id, pp.products.id)
      const parts = [pp.option_axis1_label, pp.option_axis2_label].filter(Boolean)
      if (parts.length) priceOptMap.set(pp.id, parts.join(' · '))
    })
  }

  // "알 수 없음" 폴백 — product_price_id로 제품명을 못 구한 구독/주문을 위해
  // 라이선스(order_id→product_id→products.name)로 2차 해석 맵 구성.
  // 라이선스는 product_id NOT NULL이라 유료 주문이면 항상 제품명을 복원할 수 있다.
  const productNameByOrderId = new Map<string, string>()
  {
    const { data: userLics } = await supabase
      .from('licenses')
      .select('order_id, products(name)')
      .eq('user_id', user.id)
    ;(userLics ?? []).forEach((l: any) => {
      if (l.order_id && l.products?.name) productNameByOrderId.set(l.order_id, l.products.name)
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
        <h1 className="text-2xl font-bold text-ink font-serif">결제</h1>
        <p className="text-ink-soft text-sm mt-1">구독을 관리하고 결제 내역을 확인하세요.</p>
      </div>

      {/* 입금 대기(계좌이체) 안내 — 계좌·금액·기한 재확인 */}
      {pendingDeposits && pendingDeposits.length > 0 && (
        <section className="mb-8">
          <div className="bg-caution-soft border border-caution/30 rounded-xl p-5">
            <h2 className="text-sm font-bold text-ink mb-1">입금 대기 중인 주문</h2>
            <p className="text-xs text-ink-soft mb-3">
              아래 계좌로 <b className="text-ink">가입하신 본인 이름</b>으로 입금해 주세요. 입금이 확인되면 결제 완료로 처리됩니다.
            </p>
            <div className="bg-paper border border-rule rounded-lg px-4 py-3 mb-3 text-sm">
              <div className="flex justify-between py-0.5"><span className="text-ink-faint text-xs">은행</span><span className="text-ink font-medium">{bankInfo.bank || '—'}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-ink-faint text-xs">계좌번호</span><span className="text-ink font-mono font-medium break-all">{bankInfo.accountNumber || '—'}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-ink-faint text-xs">예금주</span><span className="text-ink font-medium">{bankInfo.accountHolder || '—'}</span></div>
            </div>
            <div className="flex flex-col gap-2">
              {(pendingDeposits as any[]).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 text-sm border-t border-caution/20 pt-2 first:border-0 first:pt-0">
                  <span className="text-ink truncate">{priceNameMap.get(o.product_price_id) ?? productNameByOrderId.get(o.id) ?? '주문'}</span>
                  <div className="text-right shrink-0">
                    <span className="text-ink font-semibold">{formatKRW(o.amount)}</span>
                    {o.deposit_expires_at && (
                      <span className="block text-[11px] text-caution">
                        입금 기한 {new Date(o.deposit_expires_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 구독 섹션 */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wider mb-4">
          구독
          {(subTotal ?? 0) > 0 && <span className="ml-2 normal-case text-ink-faint font-normal">(총 {subTotal}개)</span>}
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
                  id:                   sub.id,
                  productId,
                  productName:          priceNameMap.get(sub.product_price_id)
                                          ?? (sub.order_id ? productNameByOrderId.get(sub.order_id) : undefined)
                                          ?? 'CoreZent 제품',
                  optionLabel:          priceOptMap.get(sub.product_price_id) ?? null,
                  billingInterval:      sub.billing_interval,
                  currentPeriodEnd:     sub.current_period_end ?? null,
                  status:               sub.status,
                  cancelAtPeriodEnd:    sub.cancel_at_period_end ?? false,
                  lsSubscriptionId:     sub.lemon_squeezy_subscription_id ?? null,
                  manualUrl:            priceManualMap.get(sub.product_price_id) ?? null,
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
            icon={<Package size={20} className="text-ink-faint" />}
            message="아직 구독이 없습니다."
            action={<Link href="/pricing" className="mt-3 inline-flex items-center gap-1.5 text-xs text-mark hover:underline">요금제 둘러보기 →</Link>}
          />
        )}
      </section>

      {/* 결제 내역 섹션 */}
      <section>
        <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wider mb-4">
          결제 내역
          {(ordTotal ?? 0) > 0 && <span className="ml-2 normal-case text-ink-faint font-normal">(총 {ordTotal}개)</span>}
        </h2>
        {orders && orders.length > 0 ? (
          <>
            <div className="bg-paper-raised border border-rule rounded-xl overflow-hidden">
              <div className="hidden md:grid grid-cols-[1fr_160px_120px_100px] gap-4 px-5 py-3 border-b border-rule text-xs text-ink-faint font-medium">
                <span>제품</span>
                <span>날짜</span>
                <span>금액</span>
                <span>상태</span>
              </div>
              {orders.map((order: any) => (
                <div
                  key={order.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_160px_120px_100px] gap-2 md:gap-4 items-center px-5 py-4 border-b border-rule last:border-0 hover:bg-paper-shade transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard size={14} className="text-ink-faint shrink-0 hidden md:block" />
                    <div>
                      <span className="text-sm text-ink">{priceNameMap.get(order.product_price_id) ?? productNameByOrderId.get(order.id) ?? '주문'}</span>
                      {priceOptMap.get(order.product_price_id) && (
                        <span className="block text-xs text-mark mt-0.5">{priceOptMap.get(order.product_price_id)}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-ink-soft">
                    {new Date(order.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-sm text-ink font-medium">
                    {formatKRW(order.amount)}
                  </span>
                  <OrderStatusBadge status={order.status} amount={Number(order.amount) || 0} />
                </div>
              ))}
            </div>
            <Pagination page={ordPage} total={ordTotal ?? 0} pageSize={ORD_PAGE_SIZE} buildHref={ordHref} />
          </>
        ) : (
          <EmptyCard icon={<CreditCard size={20} className="text-ink-faint" />} message="아직 결제 내역이 없습니다." />
        )}
      </section>
    </div>
  )
}

// ─── 서브 컴포넌트 ───────────────────────────────────────────

function EmptyCard({ icon, message, action }: { icon: React.ReactNode; message: string; action?: React.ReactNode }) {
  return (
    <div className="bg-paper-raised border border-rule rounded-xl py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-paper-shade flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="text-sm text-ink-faint">{message}</p>
      {action}
    </div>
  )
}

function OrderStatusBadge({ status, amount }: { status: string; amount: number }) {
  // ₩0(무료·테스트) 주문은 "결제 완료"와 구분되는 '무료' 배지로 표시
  if (status === 'paid' && amount <= 0) {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full border font-medium text-center text-info bg-info-soft border-info/20">
        무료
      </span>
    )
  }
  const map: Record<string, string> = {
    paid:            'text-ok bg-ok-soft border-ok/20',
    pending:         'text-caution bg-caution-soft border-caution/20',
    pending_deposit: 'text-caution bg-caution-soft border-caution/20',
    failed:          'text-danger bg-danger-soft border-danger/20',
    refunded:        'text-info bg-info-soft border-info/20',
    cancelled:       'text-ink-soft bg-paper-shade border-rule',
  }
  const labelMap: Record<string, string> = {
    paid: '결제 완료', pending: '대기 중', pending_deposit: '입금 대기', failed: '실패', refunded: '환불됨', cancelled: '취소됨',
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium text-center ${map[status] ?? map.pending}`}>
      {labelMap[status] ?? status}
    </span>
  )
}
