/**
 * @컴포넌트: ProductSection
 * @설명: 제품 목록 섹션 — 현재 판매 중인 소프트웨어 카드 그리드
 */

import Link from 'next/link'
import { ArrowRight, Sparkles, Clock } from 'lucide-react'

const products = [
  {
    name: 'GeniePost',
    tagline: 'AI WordPress Auto-Posting',
    description:
      'Automatically generate SEO-optimized blog posts and publish them directly to your WordPress site — powered by AI.',
    badge: 'Available now',
    badgeStyle: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20',
    tags: ['AI', 'WordPress', 'SEO', 'Automation'],
    monthlyPrice: '$9',
    annualPrice: '$99',
    href: '/auth/register',
    available: true,
  },
  {
    name: 'Coming Soon',
    tagline: 'New Product in Development',
    description:
      'We are working on our next software product. Sign up to be notified when it launches.',
    badge: 'Coming soon',
    badgeStyle: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]',
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
    badge: 'Coming soon',
    badgeStyle: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]',
    tags: [],
    monthlyPrice: null,
    annualPrice: null,
    href: '/auth/register',
    available: false,
  },
]

export default function ProductSection() {
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
              {/* Corner glow for available products */}
              {product.available && (
                <div
                  className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-[0.1]"
                  style={{ background: 'radial-gradient(circle, #38BDF8, transparent)' }}
                />
              )}

              <div className="relative z-10 flex flex-col flex-1">
                {/* Badge */}
                <div
                  className={`inline-flex items-center gap-1.5 self-start border rounded-lg px-2.5 py-1 text-xs font-semibold mb-5 ${product.badgeStyle}`}
                >
                  {product.available ? (
                    <Sparkles size={11} />
                  ) : (
                    <Clock size={11} />
                  )}
                  {product.badge}
                </div>

                {/* Name & tagline */}
                <h3 className="text-xl font-bold text-white mb-1">{product.name}</h3>
                <p className="text-[#38BDF8] text-sm font-medium mb-4">{product.tagline}</p>

                {/* Description */}
                <p className="text-[#94A3B8] text-sm leading-relaxed mb-6 flex-1">
                  {product.description}
                </p>

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
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl font-bold text-white">
                        {product.monthlyPrice}
                        <span className="text-sm text-[#94A3B8] font-normal">/mo</span>
                      </span>
                      <span className="text-xs text-[#475569]">or {product.annualPrice}/yr</span>
                    </div>
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
