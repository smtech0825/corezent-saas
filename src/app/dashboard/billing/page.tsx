/**
 * @파일: dashboard/billing/page.tsx
 * @설명: 결제 — 구독과 결제 내역을 하나의 통합 표(BillingTable)로 표시.
 *        각 행은 주문 1건이며, 구독이 연결된 주문은 갱신일·구독 취소를 관리 열에 노출한다.
 *        입금 대기(계좌이체) 주문은 상단 안내 패널로 계좌·금액·기한을 재확인할 수 있다.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreditCard } from 'lucide-react'
import Pagination from '@/components/common/Pagination'
import BillingTable, { type BillingRow } from './BillingTable'
// PC 한도 판정·허용 tier 목록의 단일 출처 — "더 큰 플랜" 후보 산출에 재사용
// (대수 비교·목록 판정일 뿐 금액 계산 아님)
import { hwidLimitForTier, isKnownTier } from '@/app/api/license/_lib_supabase'
import type { UpgradeOption } from './PlanUpgradeButton'
import { formatKRW } from '@/lib/money'
import PageContainer from '@/components/common/PageContainer'
import EmptyState from '@/components/common/EmptyState'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '결제',
}

const PAGE_SIZE = 15  // 통합 표 15행

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: orders, count: ordTotal }, { data: pendingDeposits }] = await Promise.all([
    // 주문 1건 = 표 1행. 구독이 연결된 주문은 subscriptions(...) 임베드로 갱신일·취소 정보를 함께 가져온다.
    supabase
      .from('orders')
      .select('id, amount, status, created_at, payment_method, product_price_id, subscriptions(id, status, cancel_at_period_end, current_period_end, billing_interval, lemon_squeezy_subscription_id, product_price_id)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    // 입금 대기(계좌이체) 주문 — 안내 재확인용(페이지네이션과 별개로 전체)
    supabase
      .from('orders')
      .select('id, amount, created_at, product_price_id, deposit_expires_at')
      .eq('user_id', user.id)
      .eq('status', 'pending_deposit')
      .order('created_at', { ascending: false }),
  ])

  // product_price_id → 제품명/옵션 라벨
  /**
   * @함수명: subOf
   * @설명: 주문 행에 임베드된 구독(단건/배열 모두)을 꺼냅니다.
   * @매개변수: o - 주문 행
   * @반환값: 구독 객체 또는 null
   */
  function subOf(o: { subscriptions?: unknown }): { product_price_id?: string | null } | null {
    const raw = o.subscriptions
    const s = Array.isArray(raw) ? raw[0] : raw
    return (s ?? null) as { product_price_id?: string | null } | null
  }

  // 라벨·정보 맵 대상 — 주문의 옵션행 + 구독의 현재 옵션행(플랜 변경 뒤에는 둘이 달라진다.
  // 구독 쪽이 현재 플랜의 정본이므로 라벨·후보는 구독 기준으로 그린다 — 검증 지적)
  const priceIds = [...new Set([
    ...(orders ?? []).map((o: any) => o.product_price_id),
    ...(orders ?? []).map((o: any) => subOf(o)?.product_price_id),
    ...(pendingDeposits ?? []).map((o: any) => o.product_price_id),
  ].filter(Boolean))]

  const priceNameMap = new Map<string, string>()
  const priceOptMap = new Map<string, string>()
  // 플랜 올리기 후보 산출용 — 현재 옵션의 상품·주기(정본 컬럼)·tier 정보
  const priceInfoMap = new Map<string, { productId: string; interval: string; tier: string }>()
  if (priceIds.length > 0) {
    const { data: prices } = await supabase
      .from('product_prices')
      .select('id, product_id, license_tier, interval, option_axis1_label, option_axis2_label, products(name)')
      .in('id', priceIds)
    ;(prices ?? []).forEach((pp: any) => {
      priceNameMap.set(pp.id, pp.products?.name ?? 'CoreZent 제품')
      const parts = [pp.option_axis1_label, pp.option_axis2_label].filter(Boolean)
      if (parts.length) priceOptMap.set(pp.id, parts.join(' · '))
      priceInfoMap.set(pp.id, {
        productId: pp.product_id ?? '',
        interval: String(pp.interval ?? ''),
        tier: String(pp.license_tier ?? ''),
      })
    })
  }

  // 플랜 올리기 후보 — 구독이 있는 상품의 활성 구독형 옵션행 전체를 한 번에 조회해,
  // 같은 상품·같은 결제 주기(interval — 라벨 아님)에서 PC 한도가 지금보다 큰 옵션만
  // 후보로 삼는다. 한도 판정은 라이선스 검증과 같은 hwidLimitForTier(금액 비교 아님),
  // tier는 발급·저장 가능한 값(KNOWN_TIERS)만 인정 — 그 밖의 값은 결제 후 반영이
  // 실패하므로 후보에서 제외한다(검증 지적).
  const subProductIds: string[] = [...new Set(
    (orders ?? [])
      .map((o: any) => {
        const subPriceId = subOf(o)?.product_price_id ?? o.product_price_id
        return priceInfoMap.get(subPriceId ?? '')?.productId
      })
      .filter((v: string | undefined): v is string => !!v),
  )]
  type UpgradeRow = { id: string; product_id: string; license_tier: string | null; interval: string | null; option_axis1_label: string | null; option_axis2_label: string | null; lemon_squeezy_variant_id: string | null }
  let upgradeRows: UpgradeRow[] = []
  if (subProductIds.length > 0) {
    const { data: ur } = await supabase
      .from('product_prices')
      .select('id, product_id, license_tier, interval, option_axis1_label, option_axis2_label, lemon_squeezy_variant_id')
      .in('product_id', subProductIds)
      .eq('is_active', true)
      .eq('type', 'subscription')
    upgradeRows = (ur ?? []) as UpgradeRow[]
  }

  /**
   * @함수명: buildUpgradeOptions
   * @설명: 현재 옵션행 기준으로 "올릴 수 있는" 상위 옵션 목록을 만듭니다
   *        (같은 상품·같은 주기·허용 tier·한도 더 큼·결제사 variant 있음). 한도 오름차순.
   * @매개변수: currentPriceId - 지금 구독의 옵션행 id(구독 기준 — 주문 기준 아님)
   * @반환값: 상위 옵션 목록(없으면 빈 배열 — 버튼 미노출)
   */
  function buildUpgradeOptions(currentPriceId: string | null): UpgradeOption[] {
    if (!currentPriceId) return []
    const cur = priceInfoMap.get(currentPriceId)
    if (!cur || !cur.productId || !isKnownTier(cur.tier)) return []
    const curLimit = hwidLimitForTier(cur.tier)
    return upgradeRows
      .filter((r) =>
        r.product_id === cur.productId &&
        String(r.interval ?? '') === cur.interval &&
        !!r.lemon_squeezy_variant_id &&
        isKnownTier(r.license_tier) &&
        hwidLimitForTier(String(r.license_tier)) > curLimit)
      .sort((a, b) => hwidLimitForTier(String(a.license_tier)) - hwidLimitForTier(String(b.license_tier)))
      .map((r) => ({
        priceId: r.id,
        label: [r.option_axis1_label, r.option_axis2_label].filter(Boolean).join(' · ') || '상위 옵션',
      }))
  }

  // "주문" 폴백 — product_price_id로 제품명을 못 구한 주문을 order_id→제품명(라이선스)으로 2차 해석
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

  // 입금 대기 안내 패널용 계좌 정보(front_settings — 공개 설정값, 서버에서 admin으로 조회)
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

  // 통합 표 행 구성
  const rows: BillingRow[] = (orders ?? []).map((o: any) => {
    const subsRaw = o.subscriptions
    const s = Array.isArray(subsRaw) ? subsRaw[0] : subsRaw
    return {
      orderId:      o.id,
      productName:  priceNameMap.get(o.product_price_id) ?? productNameByOrderId.get(o.id) ?? '주문',
      optionLabel:  priceOptMap.get(o.product_price_id) ?? null,
      createdAt:    o.created_at,
      amount:       o.amount ?? 0,
      paymentMethod: o.payment_method ?? 'card',
      orderStatus:  o.status,
      subscription: s ? {
        id:                s.id,
        status:            s.status,
        cancelAtPeriodEnd: s.cancel_at_period_end ?? false,
        currentPeriodEnd:  s.current_period_end ?? null,
        billingInterval:   s.billing_interval ?? null,
        lsSubscriptionId:  s.lemon_squeezy_subscription_id ?? null,
        // 현재 플랜의 정본은 구독의 옵션행이다 — 플랜 변경 뒤 주문 행은 옛 옵션으로 남는다
        currentOptionLabel: priceOptMap.get(s.product_price_id ?? o.product_price_id) ?? '',
        upgradeOptions:    buildUpgradeOptions((s.product_price_id ?? o.product_price_id) ?? null),
      } : null,
    }
  })

  return (
    <PageContainer variant="dashboard">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink font-serif">결제</h1>
        <p className="text-ink-soft text-sm mt-1">구독과 결제 내역을 한 곳에서 확인하세요.</p>
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

      {/* 통합 결제 표 */}
      <section>
        <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wider mb-4">
          구독 · 결제 내역
          {(ordTotal ?? 0) > 0 && <span className="ml-2 normal-case text-ink-faint font-normal">(총 {ordTotal}건)</span>}
        </h2>
        {rows.length > 0 ? (
          <>
            <BillingTable rows={rows} />
            <Pagination page={page} total={ordTotal ?? 0} pageSize={PAGE_SIZE} buildHref={(p) => `/dashboard/billing?page=${p}`} />
          </>
        ) : (
          <EmptyState
            boxed
            icon={<CreditCard size={20} className="text-ink-faint" />}
            message="아직 결제 내역이 없습니다."
          />
        )}
      </section>
    </PageContainer>
  )
}
