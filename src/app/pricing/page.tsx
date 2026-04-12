/**
 * @파일: pricing/page.tsx
 * @설명: 요금제 페이지 — DB에서 제품 + 가격 동적 조회 후 PricingClient에 전달
 */

import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { createAdminClient } from '@/lib/supabase/admin'
import PricingClient, { type PricingProduct } from './PricingClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pricing — CoreZent',
  description: 'Simple, transparent pricing. Pick the tools you need or bundle everything for maximum savings.',
}


export default async function PricingPage() {
  const client = createAdminClient()

  // 제품 + 가격 병렬 조회
  const [{ data: dbProducts }, { data: dbPrices }] = await Promise.all([
    client
      .from('products')
      .select('id, slug, name, category, tagline, pricing_features, order_index')
      .eq('is_active', true)
      .order('order_index'),
    client
      .from('product_prices')
      .select('product_id, type, interval, price, checkout_url')
      .eq('is_active', true),
  ])

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

    return {
      id:                   p.id as string,
      slug:                 (p.slug as string) ?? '',
      name:                 (p.name as string) ?? '',
      category:             (p.category as string) ?? 'desktop',
      tagline:              (p.tagline as string) ?? '',
      pricingFeatures:      ((p.pricing_features ?? []) as string[]).filter(Boolean),
      monthlyPrice,
      annualMonthlyPrice,
      annualPrice,
      monthlyCheckoutUrl:   monthly?.checkout_url ?? oneTime?.checkout_url ?? '#',
      annualCheckoutUrl:    annual?.checkout_url ?? '#',
      hasAnnualPlan:        !!annual,
      isOneTime:            !monthly && !annual && !!oneTime,
    }
  })

  return (
    <div className="min-h-screen bg-[#0B1120] font-sans">
      <Navbar />

      <main>
        <PricingClient products={products} />
      </main>

      <Footer />
    </div>
  )
}
