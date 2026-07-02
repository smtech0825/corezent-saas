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

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '요금제',
  description: '간단하고 투명한 요금제. 필요한 도구를 선택하세요.',
}


export default async function PricingPage() {
  const client = createAdminClient()

  // 제품·가격·추천인 코드 병렬 조회 (추천인은 httpOnly cz_ref를 서버에서 해석)
  // 옵션 진열 컬럼(039)은 우선 조회 → 미적용 시 폴백(옵션 없이 기존 단독 카드로 정상 동작)
  const OPT_COLS = 'id, slug, name, category, tagline, badge_text, badge_color, pricing_features, order_index, option_group, option_axis1_name, option_axis1_label, option_axis2_name, option_axis2_label'
  const BASE_COLS = 'id, slug, name, category, tagline, badge_text, badge_color, pricing_features, order_index'
  const productsQuery = client
    .from('products')
    .select(OPT_COLS)
    .eq('is_active', true)
    .order('order_index')

  const [productsRes, { data: dbPrices }, affiliateRef] = await Promise.all([
    productsQuery,
    client
      .from('product_prices')
      .select('product_id, type, interval, price, checkout_url')
      .eq('is_active', true),
    resolveCheckoutAffiliateRef(),
  ])

  const dbProducts = productsRes.error
    ? (await client.from('products').select(BASE_COLS).eq('is_active', true).order('order_index')).data
    : productsRes.data

  // 가격을 product_id별로 그룹화
  const priceMap = new Map<string, Array<{
    type: string; interval: string | null; price: number; checkout_url: string | null
  }>>()

  for (const p of (dbPrices ?? []) as Array<Record<string, unknown>>) {
    const pid = p.product_id as string
    if (!priceMap.has(pid)) priceMap.set(pid, [])
    priceMap.get(pid)!.push({
      type: p.type as string,
      interval: (p.interval as string) ?? null,
      price: p.price as number,
      checkout_url: (p.checkout_url as string) ?? null,
    })
  }

  // PricingProduct 배열 조립
  const products: PricingProduct[] = ((dbProducts ?? []) as Array<Record<string, unknown>>).map((p) => {
    const prices = priceMap.get(p.id as string) ?? []
    const monthly = prices.find((pr) => pr.type === 'subscription' && pr.interval === 'monthly')
    const annual  = prices.find((pr) => pr.type === 'subscription' && pr.interval === 'annual')
    const oneTime = prices.find((pr) => pr.type === 'one_time')

    // 월간 가격: monthly 우선, 없으면 one_time
    const monthlyPrice = monthly?.price ?? oneTime?.price ?? 0
    // 연간 가격: annual 엔트리 값 (없으면 월간×12)
    const annualPrice = annual?.price ?? monthlyPrice * 12
    // 연간 결제 시 월 환산 가격
    const annualMonthlyPrice = annual ? annualPrice / 12 : monthlyPrice

    // 옵션 카드용 대표 단가/URL — 이 조합 상품의 실제 결제 금액(월간→연간→일회 우선)
    const rep = monthly ?? annual ?? oneTime ?? null
    const unitPrice = rep?.price ?? 0
    const unitCheckoutUrl = rep?.checkout_url ?? '#'
    const priceSuffix = monthly ? '/월' : annual ? '/년' : ''

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
      // 옵션 진열(039) — 폴백 조회 시 컬럼이 없으므로 옵셔널 안전 접근
      optionGroup:          ((p as { option_group?: string | null }).option_group) ?? null,
      axis1Name:            ((p as { option_axis1_name?: string | null }).option_axis1_name) ?? null,
      axis1Label:           ((p as { option_axis1_label?: string | null }).option_axis1_label) ?? null,
      axis2Name:            ((p as { option_axis2_name?: string | null }).option_axis2_name) ?? null,
      axis2Label:           ((p as { option_axis2_label?: string | null }).option_axis2_label) ?? null,
      unitPrice,
      unitCheckoutUrl,
      priceSuffix,
    }
  })

  return (
    <div className="min-h-screen bg-[#0B1120] font-sans">
      <Navbar />

      <main>
        <PricingClient products={products} affiliateRef={affiliateRef} />
      </main>

      <Footer />
    </div>
  )
}
