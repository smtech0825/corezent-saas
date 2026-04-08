/**
 * @파일: app/product/page.tsx
 * @설명: 상품 목록 페이지 (/product)
 *        - DB에서 활성 상품을 가져와 카드 그리드로 표시
 *        - 각 카드에 "More Info" 버튼으로 상품 특징 아코디언 확장
 */

import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ProductList from './ProductList'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Products — CoreZent',
  description:
    'Browse all CoreZent software products. AI-powered tools and productivity apps built to save your time.',
}

export default async function ProductPage() {
  const client = createAdminClient()

  // 활성 상품 + 가격 정보 조회 (order_index 순)
  const { data: rawProducts } = await client
    .from('products')
    .select('id, name, tagline, description, category, features, tags, product_features, logo_url, is_active, order_index, product_prices(type, interval, price, is_active)')
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  // 상품별 월간/연간 가격 추출
  const products = (rawProducts ?? []).map((p) => {
    const prices = (p.product_prices ?? []) as Array<{ type: string; interval: string | null; price: number; is_active: boolean }>
    const activePrices = prices.filter((pr) => pr.is_active)
    const monthly = activePrices.find((pr) => pr.type === 'subscription' && pr.interval === 'monthly')
    const annual = activePrices.find((pr) => pr.type === 'subscription' && pr.interval === 'annual')
    return {
      id: p.id as string,
      name: p.name as string,
      tagline: p.tagline as string | null,
      description: p.description as string | null,
      category: p.category as string,
      features: (p.features ?? []) as string[],
      tags: (p.tags ?? []) as string[],
      product_features: (p.product_features ?? []) as Array<{ icon: string; image_url: string; title: string; description: string }>,
      logo_url: p.logo_url as string | null,
      is_active: p.is_active as boolean,
      monthlyPrice: monthly?.price ?? null,
      annualPrice: annual?.price ?? null,
    }
  })

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0B1120]">
        <section className="relative pt-36 pb-32 px-6">
          {/* Glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(56,189,248,0.05) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 max-w-7xl mx-auto">
            {/* 헤더 */}
            <div className="text-center mb-16">
              <p className="text-[#38BDF8] text-sm font-semibold tracking-widest uppercase mb-4">
                Our Products
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Software that works for you.
              </h1>
              <p className="text-[#94A3B8] text-lg max-w-xl mx-auto">
                Every product we build is designed to save time, reduce friction, and deliver real
                results — from day one.
              </p>
            </div>

            {/* 상품 목록 */}
            <ProductList products={products} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
