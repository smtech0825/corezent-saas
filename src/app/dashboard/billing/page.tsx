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
import { formatKRW } from '@/lib/money'

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
      .select('id, amount, status, created_at, payment_method, product_price_id, subscriptions(id, status, cancel_at_period_end, current_period_end, billing_interval, lemon_squeezy_subscription_id)', { count: 'exact' })
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
  const priceIds = [...new Set([
    ...(orders ?? []).map((o: any) => o.product_price_id),
    ...(pendingDeposits ?? []).map((o: any) => o.product_price_id),
  ].filter(Boolean))]

  const priceNameMap = new Map<string, string>()
  const priceOptMap = new Map<string, string>()
  if (priceIds.length > 0) {
    const { data: prices } = await supabase
      .from('product_prices')
      .select('id, option_axis1_label, option_axis2_label, products(name)')
      .in('id', priceIds)
    ;(prices ?? []).forEach((pp: any) => {
      priceNameMap.set(pp.id, pp.products?.name ?? 'CoreZent 제품')
      const parts = [pp.option_axis1_label, pp.option_axis2_label].filter(Boolean)
      if (parts.length) priceOptMap.set(pp.id, parts.join(' · '))
    })
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
      } : null,
    }
  })

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-6xl mx-auto">
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
          <div className="bg-paper-raised border border-rule rounded-xl py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-paper-shade flex items-center justify-center mx-auto mb-3">
              <CreditCard size={20} className="text-ink-faint" />
            </div>
            <p className="text-sm text-ink-faint">아직 결제 내역이 없습니다.</p>
          </div>
        )}
      </section>
    </div>
  )
}
