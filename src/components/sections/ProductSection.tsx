/**
 * @컴포넌트: ProductSection
 * @설명: 랜딩 페이지 제품 목록 섹션 — DB에서 상품 정보를 가져와 카드 그리드로 표시
 *        Admin에서 등록한 상품이 자동으로 반영됨
 */

import Link from 'next/link'
import { ArrowRight, Sparkles, Clock } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

interface ProductCard {
  name: string
  tagline: string
  description: string
  tags: string[]
  monthlyPrice: string | null
  annualPrice: string | null
  href: string
  available: boolean
}

// Coming Soon 플레이스홀더
const COMING_SOON: ProductCard[] = [
  {
    name: 'Coming Soon',
    tagline: 'New Product in Development',
    description:
      'We are working on our next software product. Sign up to be notified when it launches.',
    tags: [],
    monthlyPrice: null,
    annualPrice: null,
    href: '/auth/register',
    available: false,
  },
  {
    name: 'Coming Soon',
    tagline: 'More tools on the way',
    description:
      'CoreZent is continuously expanding its product lineup. Stay tuned for more powerful software tools.',
    tags: [],
    monthlyPrice: null,
    annualPrice: null,
    href: '/auth/register',
    available: false,
  },
]

export default async function ProductSection() {
  const client = createAdminClient()

  // 모든 상품 + 활성 가격 조회
  const { data: rawProducts } = await client
    .from('products')
    .select('name, tagline, description, tags, is_active, order_index, product_prices(type, interval, price, is_active)')
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  // DB 상품 → 카드 데이터 변환
  const dbCards: ProductCard[] = (rawProducts ?? []).map((p) => {
    const prices = ((p.product_prices ?? []) as Array<{ type: string; interval: string | null; price: number; is_active: boolean }>)
      .filter((pr) => pr.is_active)
    const monthly = prices.find((pr) => pr.type === 'subscription' && pr.interval === 'monthly')
    const annual = prices.find((pr) => pr.type === 'subscription' && pr.interval === 'annual')

    return {
      name: p.name as string,
      tagline: (p.tagline as string) ?? '',
      description: (p.description as string) ?? '',
      tags: ((p.tags ?? []) as string[]),
      monthlyPrice: monthly ? `$${monthly.price.toFixed(2)}` : null,
      annualPrice: annual ? `$${annual.price}` : null,
      href: '/pricing',
      available: true,
    }
  })

  // 활성 상품 + Coming Soon 플레이스홀더로 최소 3개 채우기
  const neededPlaceholders = Math.max(0, 3 - dbCards.length)
  const products = [...dbCards, ...COMING_SOON.slice(0, neededPlaceholders)]

  return (
    <section id="product" className="relative py-32 px-6">
      {/* Glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(56,189,248,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[#38BDF8] text-sm font-semibold tracking-widest uppercase mb-4">
            Our Products
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Software that works for you.
          </h2>
          <p className="text-[#94A3B8] text-lg max-w-xl mx-auto">
            Every product we build is designed to save time, reduce friction, and
            deliver real results — from day one.
          </p>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((product, idx) => (
            <div
              key={idx}
              className={`relative flex flex-col border rounded-2xl p-7 transition-all duration-300 group ${
                product.available
                  ? 'border-[#38BDF8]/20 bg-[#111A2E] hover:border-[#38BDF8]/40'
                  : 'border-[#1E293B] bg-[#0E1525] opacity-60'
              }`}
            >
              {/* Corner glow */}
              {product.available && (
                <div
                  className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-[0.1]"
                  style={{ background: 'radial-gradient(circle, #38BDF8, transparent)' }}
                />
              )}

              <div className="relative z-10 flex flex-col flex-1">
                {/* Badge */}
                <div
                  className={`inline-flex items-center gap-1.5 self-start border rounded-lg px-2.5 py-1 text-xs font-semibold mb-5 ${
                    product.available
                      ? 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20'
                      : 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]'
                  }`}
                >
                  {product.available ? <Sparkles size={11} /> : <Clock size={11} />}
                  {product.available ? 'Available now' : 'Coming soon'}
                </div>

                {/* Name & tagline */}
                <h3 className="text-xl font-bold text-white mb-1">{product.name}</h3>
                <p className="text-[#38BDF8] text-sm font-medium mb-4">{product.tagline}</p>

                {/* Description */}
                {product.description && (
                  <p className="text-[#94A3B8] text-sm leading-relaxed mb-4">
                    {product.description}
                  </p>
                )}

                {/* Tags */}
                {product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs border border-[#1E293B] text-[#475569] rounded-full px-2.5 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Pricing + CTA */}
                {product.available ? (
                  <div className="mt-auto">
                    {product.monthlyPrice && (
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl font-bold text-white">
                          {product.monthlyPrice}
                          <span className="text-sm text-[#94A3B8] font-normal">/mo</span>
                        </span>
                        {product.annualPrice && (
                          <span className="text-xs text-[#475569]">
                            or {product.annualPrice}/yr
                          </span>
                        )}
                      </div>
                    )}
                    <Link
                      href={product.href}
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold py-2.5 rounded-xl text-sm hover:bg-[#0ea5e9] transition-all duration-200"
                    >
                      Get started
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <div className="mt-auto">
                    <Link
                      href={product.href}
                      className="w-full inline-flex items-center justify-center gap-2 border border-[#1E293B] text-[#475569] font-medium py-2.5 rounded-xl text-sm cursor-not-allowed"
                      tabIndex={-1}
                    >
                      Notify me
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
