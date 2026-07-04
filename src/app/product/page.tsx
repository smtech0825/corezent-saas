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
import { lowestPriceRow } from '@/lib/product-pricing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '제품',
  description:
    'CoreZent의 모든 소프트웨어 제품을 둘러보세요. 시간을 아껴주는 AI 자동화 도구와 생산성 앱.',
}

export default async function ProductPage() {
  const client = createAdminClient()

  // 활성 상품 + 가격 정보 조회 (order_index 순)
  // category_group(마이그레이션 035) 우선 조회 → 컬럼 미적용 시 폴백(목록은 정상, 카테고리 필터만 비활성)
  // 목록 카드는 list_description(목록 전용 짧은 소개)만 사용 — description(상세 HTML)은 목록에 노출하지 않는다
  const BASE_COLS = 'id, name, slug, tagline, list_description, category, features, tags, product_features, logo_url, badge_text, badge_color, is_active, order_index, product_prices(type, interval, price, is_active)'
  const withRes = await client
    .from('products')
    .select('id, name, slug, tagline, list_description, category, category_group, features, tags, product_features, logo_url, badge_text, badge_color, is_active, order_index, product_prices(type, interval, price, is_active)')
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  const { data: rawProducts } = withRes.error
    ? await client.from('products').select(BASE_COLS).eq('is_active', true).order('order_index', { ascending: true })
    : withRes

  // 상품별 월간/연간 가격 추출
  const products = (rawProducts ?? []).map((p) => {
    const prices = (p.product_prices ?? []) as Array<{ type: string; interval: string | null; price: number; is_active: boolean }>
    const activePrices = prices.filter((pr) => pr.is_active)
    // 대표가는 '첫 행'이 아니라 '최저가 행'으로 선택(고가 티어가 대표가로 노출되던 문제 방지)
    const monthly = lowestPriceRow(activePrices, (pr) => pr.type === 'subscription' && pr.interval === 'monthly')
    const annual = lowestPriceRow(activePrices, (pr) => pr.type === 'subscription' && pr.interval === 'annual')
    return {
      id: p.id as string,
      name: p.name as string,
      slug: p.slug as string,
      tagline: p.tagline as string | null,
      // 목록 전용 짧은 소개(plain text). 상세 description은 목록에서 사용하지 않음
      list_description: (p.list_description as string) ?? '',
      category: p.category as string,
      // 폴백(035 미적용) 시 컬럼이 없으므로 옵셔널로 안전 접근
      category_group: ((p as { category_group?: string | null }).category_group) ?? null,
      features: (p.features ?? []) as string[],
      tags: (p.tags ?? []) as string[],
      product_features: (p.product_features ?? []) as Array<{ icon: string; image_url: string; title: string; description: string }>,
      logo_url: p.logo_url as string | null,
      badgeText: (p.badge_text as string) ?? null,
      badgeColor: (p.badge_color as string) ?? 'blue',
      is_active: p.is_active as boolean,
      monthlyPrice: monthly?.price ?? null,
      annualPrice: annual?.price ?? null,
    }
  })

  return (
    <>
      <Navbar />
      <main className="theme-paper min-h-screen bg-paper text-ink">
        <section className="relative pt-10 sm:pt-14 pb-24 px-4 sm:px-6">
          {/* Glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(29,63,176,0.04) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 max-w-7xl mx-auto">
            {/* 헤더 */}
            <div className="text-center mb-16">
              <p className="text-pen text-sm font-semibold tracking-widest uppercase mb-4">
                제품 소개
              </p>
              <h1 className="text-4xl sm:text-5xl font-serif font-black text-ink mb-4">
                나를 위해 일하는 소프트웨어
              </h1>
              <p className="text-ink-soft text-lg max-w-xl mx-auto">
                우리가 만드는 모든 제품은 첫날부터 시간을 아끼고, 번거로움을 줄이고,
                실질적인 결과를 전하도록 설계되었습니다.
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
