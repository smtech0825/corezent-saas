import type { Metadata } from 'next'
import lazy from 'next/dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
// Hero는 즉시 표시 필요 — 정적 import 유지
import HeroSection from '@/components/sections/HeroSection'
// 타입만 import (런타임 코드 없음)
import type { PricingSectionProduct } from '@/components/sections/PricingSection'

// Below-fold 섹션 — 별도 JS 청크로 분리 (초기 번들 절감)
const ProductSection      = lazy(() => import('@/components/sections/ProductSection'))
const HowItWorksSection   = lazy(() => import('@/components/sections/HowItWorksSection'))
const FeaturesSection     = lazy(() => import('@/components/sections/FeaturesSection'))
const PricingSection      = lazy(() => import('@/components/sections/PricingSection'))
const TestimonialsSection = lazy(() => import('@/components/sections/TestimonialsSection'))
const FAQSection          = lazy(() => import('@/components/sections/FAQSection'))
const CTASection          = lazy(() => import('@/components/sections/CTASection'))

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'CoreZent — Software Built for You',
  description:
    'CoreZent creates and sells thoughtfully-built software — from AI automation tools to productivity apps. Simple pricing, instant activation.',
}

// 섹션 기본 설정 (DB에 없을 경우 fallback)
const defaultSections = [
  { name: 'hero',         is_visible: true, order_index: 0 },
  { name: 'product',      is_visible: true, order_index: 1 },
  { name: 'how_it_works', is_visible: true, order_index: 2 },
  { name: 'features',     is_visible: true, order_index: 3 },
  { name: 'pricing',      is_visible: true, order_index: 4 },
  { name: 'testimonials', is_visible: true, order_index: 5 },
  { name: 'faq',          is_visible: true, order_index: 6 },
  { name: 'cta',          is_visible: true, order_index: 7 },
]

export default async function HomePage() {
  const client = createAdminClient()

  // 병렬로 모든 DB 데이터 조회
  const [sectionsRes, featuresRes, testimonialsRes, faqsRes, contentRes, stepsRes, pricingRes] = await Promise.all([
    client.from('front_sections').select('name, is_visible, order_index').order('order_index'),
    client.from('front_features').select('id, icon, tag, title, description').eq('is_published', true).order('order_index'),
    client.from('front_interviews').select('id, quote, author_name, author_title, author_avatar, rating').eq('is_published', true),
    client.from('front_faqs').select('id, question, answer').eq('is_published', true).order('order_index'),
    client.from('front_content').select('key, value'),
    client.from('front_steps').select('id, icon, title, description').eq('is_published', true).order('order_index'),
    client
      .from('products')
      .select('name, badge_text, badge_color, pricing_features, product_prices(type, interval, price, checkout_url, is_active)')
      .eq('is_active', true)
      .order('order_index'),
  ])

  // DB 섹션과 기본값 병합 후 order_index 기준 정렬
  const dbMap = new Map((sectionsRes.data ?? []).map((s) => [s.name, s]))
  const sections = defaultSections
    .map((def) => ({ ...def, ...(dbMap.get(def.name) ?? {}) }))
    .sort((a, b) => a.order_index - b.order_index)

  const features     = featuresRes.data ?? []
  const testimonials = testimonialsRes.data ?? []
  const faqs         = faqsRes.data ?? []
  const steps        = stepsRes.data ?? []

  // 전체 활성 상품 기반 랜딩 Pricing 섹션 데이터 빌드
  type PriceRow = { type: string; interval: string | null; price: number; checkout_url: string | null; is_active: boolean }
  const featuredProducts: PricingSectionProduct[] = ((pricingRes.data ?? []) as Record<string, unknown>[]).map((pricingRaw) => {
    const prices = ((pricingRaw.product_prices ?? []) as PriceRow[]).filter((pr) => pr.is_active)
    const monthly  = prices.find((pr) => pr.type === 'subscription' && pr.interval === 'monthly')
    const annual   = prices.find((pr) => pr.type === 'subscription' && pr.interval === 'annual')
    const oneTime  = prices.find((pr) => pr.type === 'one_time')
    const monthlyPrice = monthly?.price ?? 0
    const annualPrice  = annual?.price ?? 0
    return {
      name:               pricingRaw.name as string,
      badgeText:          (pricingRaw.badge_text as string) ?? null,
      badgeColor:         (pricingRaw.badge_color as string) ?? 'blue',
      pricingFeatures:    ((pricingRaw.pricing_features ?? []) as string[]).filter(Boolean),
      monthlyPrice,
      annualPrice,
      annualMonthlyPrice: annual ? annualPrice / 12 : monthlyPrice,
      monthlyCheckoutUrl: monthly?.checkout_url ?? oneTime?.checkout_url ?? '#',
      annualCheckoutUrl:  annual?.checkout_url ?? '#',
      hasAnnualPlan:      !!annual,
      isOneTime:          !monthly && !annual && !!oneTime,
      oneTimeCheckoutUrl: oneTime?.checkout_url ?? '#',
    }
  })

  // front_content key-value 맵 생성
  const contentMap = Object.fromEntries((contentRes.data ?? []).map((c) => [c.key, c.value]))

  const heroContent = {
    badge:     contentMap['hero_badge']     || null,
    headline1: contentMap['hero_headline1'] || null,
    headline2: contentMap['hero_headline2'] || null,
    subtext:   contentMap['hero_subtext']   || null,
    cta1_text: contentMap['hero_cta1_text'] || null,
    cta1_href: contentMap['hero_cta1_href'] || null,
    cta2_text: contentMap['hero_cta2_text'] || null,
    cta2_href: contentMap['hero_cta2_href'] || null,
  }

  const ctaContent = {
    eyebrow:   contentMap['cta_eyebrow']   || null,
    headline:  contentMap['cta_headline']  || null,
    subtext:   contentMap['cta_subtext']   || null,
    btn1_text: contentMap['cta_btn1_text'] || null,
    btn1_href: contentMap['cta_btn1_href'] || null,
    btn2_text: contentMap['cta_btn2_text'] || null,
    btn2_href: contentMap['cta_btn2_href'] || null,
    footnote:  contentMap['cta_footnote']  || null,
  }

  // 섹션 이름 → 컴포넌트 매핑
  const sectionMap: Record<string, React.ReactNode> = {
    hero:         <HeroSection content={heroContent} />,
    product:      <ProductSection />,
    how_it_works: <HowItWorksSection steps={steps.length > 0 ? steps : undefined} />,
    features:     <FeaturesSection features={features.length > 0 ? features : undefined} />,
    pricing:      <PricingSection products={featuredProducts} />,
    testimonials: <TestimonialsSection testimonials={testimonials.length > 0 ? testimonials : undefined} />,
    faq:          <FAQSection faqs={faqs} />,
    cta:          <CTASection content={ctaContent} />,
  }

  return (
    <div className="min-h-screen bg-[#0B1120] font-sans">
      <Navbar />
      <main>
        {sections
          .filter((s) => s.is_visible)
          .map((s) => {
            const component = sectionMap[s.name]
            if (!component) return null
            return <div key={s.name}>{component}</div>
          })}
      </main>
      <Footer />
    </div>
  )
}
