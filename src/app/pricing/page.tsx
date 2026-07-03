/**
 * @파일: pricing/page.tsx
 * @설명: 요금제 페이지 — DB에서 제품 + 가격 동적 조회 후 PricingClient에 전달
 */

import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveCheckoutAffiliateRef } from '@/lib/affiliate'
import PricingClient, { type PricingProduct } from './PricingClient'
import { lowestPriceRow } from '@/lib/product-pricing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '요금제',
  description: '간단하고 투명한 요금제. 필요한 도구를 선택하세요.',
}


export default async function PricingPage() {
  const client = createAdminClient()

  // 제품·가격·추천인 코드 병렬 조회 (추천인은 httpOnly cz_ref를 서버에서 해석)
  // 옵션 축 제목 컬럼(040)은 우선 조회 → 미적용 시 폴백(옵션 없이 기존 단독 카드로 정상 동작)
  const OPT_COLS = 'id, slug, name, category, tagline, badge_text, badge_color, pricing_features, order_index, option_axis1_name, option_axis2_name'
  const BASE_COLS = 'id, slug, name, category, tagline, badge_text, badge_color, pricing_features, order_index'
  const productsQuery = client
    .from('products')
    .select(OPT_COLS)
    .eq('is_active', true)
    .order('order_index')

  const [productsRes, pricesRes, affiliateRef] = await Promise.all([
    productsQuery,
    client
      .from('product_prices')
      .select('product_id, type, interval, price, checkout_url, option_axis1_label, option_axis2_label, license_tier, sort_order')
      .eq('is_active', true),
    resolveCheckoutAffiliateRef(),
  ])

  const dbProducts = productsRes.error
    ? (await client.from('products').select(BASE_COLS).eq('is_active', true).order('order_index')).data
    : productsRes.data
  // 옵션 컬럼(040)·순서 컬럼(041) best-effort — 미적용 시 단계적 폴백(옵션 유지 → 옵션 없이)
  const dbPrices = pricesRes.error
    ? await (async () => {
        const rOpt = await client
          .from('product_prices')
          .select('product_id, type, interval, price, checkout_url, option_axis1_label, option_axis2_label, license_tier')
          .eq('is_active', true)
        return rOpt.error
          ? (await client.from('product_prices').select('product_id, type, interval, price, checkout_url').eq('is_active', true)).data
          : rOpt.data
      })()
    : pricesRes.data

  // 가격을 product_id별로 그룹화 (옵션 라벨 포함)
  const priceMap = new Map<string, Array<{
    type: string; interval: string | null; price: number; checkout_url: string | null
    axis1Label: string | null; axis2Label: string | null; sortOrder: number | null
  }>>()

  for (const p of (dbPrices ?? []) as Array<Record<string, unknown>>) {
    const pid = p.product_id as string
    if (!priceMap.has(pid)) priceMap.set(pid, [])
    priceMap.get(pid)!.push({
      type: p.type as string,
      interval: (p.interval as string) ?? null,
      price: p.price as number,
      checkout_url: (p.checkout_url as string) ?? null,
      axis1Label: ((p as { option_axis1_label?: string | null }).option_axis1_label) ?? null,
      axis2Label: ((p as { option_axis2_label?: string | null }).option_axis2_label) ?? null,
      sortOrder: ((p as { sort_order?: number | null }).sort_order) ?? null,
    })
  }

  // PricingProduct 배열 조립
  const products: PricingProduct[] = ((dbProducts ?? []) as Array<Record<string, unknown>>).map((p) => {
    // 옵션 표시 순서(sort_order) 오름차순 정렬 — 이후 optionRows·기본가격 탐색이 이 순서를 따른다
    const prices = (priceMap.get(p.id as string) ?? []).slice().sort((a, b) => {
      const sa = a.sortOrder ?? 999999, sb = b.sortOrder ?? 999999
      return sa - sb
    })
    // 대표가는 '첫 행'이 아니라 '최저가 행'으로 선택(고가 티어가 대표가로 노출되던 문제 방지)
    const monthly = lowestPriceRow(prices, (pr) => pr.type === 'subscription' && pr.interval === 'monthly')
    const annual  = lowestPriceRow(prices, (pr) => pr.type === 'subscription' && pr.interval === 'annual')
    const oneTime = lowestPriceRow(prices, (pr) => pr.type === 'one_time')

    // 월간 가격: monthly 우선, 없으면 one_time
    const monthlyPrice = monthly?.price ?? oneTime?.price ?? 0
    // 연간 가격: annual 엔트리 값 (없으면 월간×12)
    const annualPrice = annual?.price ?? monthlyPrice * 12
    // 연간 결제 시 월 환산 가격
    const annualMonthlyPrice = annual ? annualPrice / 12 : monthlyPrice

    // v2 옵션 행 — 옵션 라벨이 있는 price 행들을 카드 드롭다운용 OptionRow로.
    // 라벨 없는 상품(옵션 미사용)은 optionRows가 비어 기존 단독 카드로 렌더된다.
    const optionRows = prices
      .filter((pr) => pr.axis1Label || pr.axis2Label)
      .map((pr) => ({
        axis1Label: pr.axis1Label,
        axis2Label: pr.axis2Label,
        price:      pr.price,
        checkoutUrl: pr.checkout_url ?? '#',
        suffix:     pr.type === 'one_time' ? '' : pr.interval === 'annual' ? '/년' : '/월',
      }))

    return {
      id:                   p.id as string,
      slug:                 (p.slug as string) ?? '',
      name:                 (p.name as string) ?? '',
      category:             (p.category as string) ?? 'desktop',
      tagline:              (p.tagline as string) ?? '',
      badgeText:            (p.badge_text as string) ?? null,
      badgeColor:           (p.badge_color as string) ?? 'blue',
      pricingFeatures:      ((p.pricing_features ?? []) as string[]).filter(Boolean),
      monthlyPrice,
      annualMonthlyPrice,
      annualPrice,
      monthlyCheckoutUrl:   monthly?.checkout_url ?? oneTime?.checkout_url ?? '#',
      annualCheckoutUrl:    annual?.checkout_url ?? '#',
      hasAnnualPlan:        !!annual,
      isOneTime:            !monthly && !annual && !!oneTime,
      // v2 옵션 — 축 제목(products) + 옵션 행(product_prices). 폴백 시 안전 접근.
      axis1Name:            ((p as { option_axis1_name?: string | null }).option_axis1_name) ?? null,
      axis2Name:            ((p as { option_axis2_name?: string | null }).option_axis2_name) ?? null,
      optionRows,
    }
  })

  return (
    <div className="theme-paper min-h-screen bg-paper font-sans text-ink">
      <Navbar />

      <main>
        <PricingClient products={products} affiliateRef={affiliateRef} />
      </main>

      <Footer />
    </div>
  )
}
