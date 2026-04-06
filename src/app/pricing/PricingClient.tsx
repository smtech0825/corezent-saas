'use client'

/**
 * @컴포넌트: PricingClient
 * @설명: 요금제 페이지 인터랙티브 영역
 *        - 카테고리 탭 필터
 *        - 연간/월간 결제 토글
 *        - 번들 배너
 *        - 제품 카드 그리드
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, Package, Zap } from 'lucide-react'
import {
  products,
  bundle,
  FILTER_LABELS,
  BADGE_STYLES,
  type FilterCategory,
} from '@/lib/products'

const FILTER_CATEGORIES: FilterCategory[] = ['all', 'chrome-extension', 'desktop', 'web-tool']

export default function PricingClient() {
  const [annual, setAnnual] = useState(false)
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all')

  const filtered = useMemo(
    () =>
      activeCategory === 'all'
        ? products
        : products.filter((p) => p.category === activeCategory),
    [activeCategory],
  )

  const bundlePrice = annual ? bundle.annualMonthlyPrice : bundle.monthlyPrice

  return (
    <div className="pt-32 sm:pt-36 pb-24 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">

        {/* 히어로 + 토글 */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 border border-[#1E293B] bg-[#111A2E] rounded-full px-4 py-1.5 text-xs text-[#38BDF8] mb-6 font-medium">
            <Zap size={12} className="fill-[#38BDF8]" />
            Transparent pricing, no hidden fees
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-5">
            Pick your tools
          </h1>
          <p className="text-[#94A3B8] text-lg max-w-md mx-auto mb-10">
            Pay only for what you use. Bundle everything and save more.
          </p>

          {/* 월간/연간 토글 */}
          <div className="inline-flex items-center gap-1 border border-[#1E293B] bg-[#111A2E] rounded-full p-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                !annual
                  ? 'bg-[#38BDF8] text-[#0B1120]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                annual
                  ? 'bg-[#38BDF8] text-[#0B1120]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Annual
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full transition-all ${
                  annual
                    ? 'bg-[#0B1120]/20 text-[#0B1120]'
                    : 'bg-emerald-500/15 text-emerald-400'
                }`}
              >
                Save 25%
              </span>
            </button>
          </div>
        </div>

        {/* 번들 패키지 배너 */}
        <div className="relative mb-10 rounded-2xl border border-[#38BDF8]/30 bg-[#111A2E] overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(56,189,248,0.07), transparent)',
            }}
          />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-6 sm:px-8 py-8">
            {/* 좌측: 정보 */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Package size={22} className="text-[#38BDF8]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-white">{bundle.name}</h2>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#38BDF8] text-[#0B1120]">
                    {bundle.badge}
                  </span>
                </div>
                <p className="text-[#94A3B8] text-sm mb-1.5">{bundle.tagline}</p>
                <p className="text-xs text-emerald-400 font-medium mb-3">{bundle.savingsNote}</p>
                <div className="flex flex-wrap gap-2">
                  {bundle.includes.map((item) => (
                    <span
                      key={item}
                      className="text-xs border border-[#1E293B] text-[#94A3B8] px-2.5 py-1 rounded-full"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 우측: 가격 + CTA */}
            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-4 w-full md:w-auto flex-shrink-0">
              <div className="text-left md:text-right">
                {annual && (
                  <p className="text-xs text-[#94A3B8] line-through">
                    ${bundle.monthlyPrice}/mo
                  </p>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">${bundlePrice}</span>
                  <span className="text-[#94A3B8] text-sm">/mo</span>
                </div>
                {annual && (
                  <p className="text-xs text-[#94A3B8]">billed annually</p>
                )}
              </div>
              <Link
                href={annual ? bundle.lemonSqueezy.annual : bundle.lemonSqueezy.monthly}
                className="inline-flex items-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold px-6 py-3 rounded-lg hover:bg-[#0ea5e9] hover:shadow-[0_8px_24px_rgba(56,189,248,0.35)] hover:-translate-y-0.5 transition-all duration-200 text-sm whitespace-nowrap"
              >
                Get the bundle
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* 카테고리 탭 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                activeCategory === cat
                  ? 'border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#38BDF8]'
                  : 'border-[#1E293B] text-[#94A3B8] hover:text-white'
              }`}
            >
              {FILTER_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* 제품 카드 그리드 */}
        {filtered.length === 0 ? (
          <p className="text-center text-[#94A3B8] py-20">해당 카테고리 제품이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-20">
            {filtered.map((product) => {
              const price = annual ? product.annualMonthlyPrice : product.monthlyPrice
              const checkoutUrl = annual
                ? product.lemonSqueezy.annual
                : product.lemonSqueezy.monthly

              return (
                <div
                  key={product.id}
                  className="group relative flex flex-col rounded-xl border border-[#1E293B] bg-[#111A2E] p-6 hover:border-[#38BDF8]/30 transition-all duration-300"
                >
                  {/* 호버 글로우 */}
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(56,189,248,0.05), transparent)',
                    }}
                  />

                  <div className="relative z-10 flex flex-col flex-1">
                    {/* 카테고리 + 뱃지 */}
                    <div className="flex items-start justify-between gap-2 mb-5">
                      <span className="text-xs font-mono text-[#38BDF8]/70 border border-[#1E293B] px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                        {FILTER_LABELS[product.category]}
                      </span>
                      {product.badge && (
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${
                            BADGE_STYLES[product.badge] ??
                            'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/20'
                          }`}
                        >
                          {product.badge}
                        </span>
                      )}
                    </div>

                    {/* 제품명 + 태그라인 */}
                    <h3 className="text-lg font-semibold text-white mb-1">{product.name}</h3>
                    <p className="text-xs text-[#94A3B8] leading-relaxed mb-6">{product.tagline}</p>

                    {/* 가격 */}
                    <div className="mb-5">
                      {annual && (
                        <p className="text-xs text-[#94A3B8] line-through">
                          ${product.monthlyPrice}/mo
                        </p>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-white">${price}</span>
                        <span className="text-[#94A3B8] text-sm">/mo</span>
                      </div>
                      {annual && (
                        <p className="text-xs text-[#94A3B8] mt-0.5">billed annually</p>
                      )}
                    </div>

                    {/* 구매 버튼 */}
                    <Link
                      href={checkoutUrl}
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold mb-6 border border-[#1E293B] text-[#F1F5F9] hover:border-[#38BDF8] hover:text-[#38BDF8] transition-all duration-200"
                    >
                      Get started
                      <ArrowRight size={13} />
                    </Link>

                    {/* 기능 목록 */}
                    <ul className="space-y-2.5 flex-1">
                      {product.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-sm text-[#94A3B8]"
                        >
                          <Check size={14} className="text-[#38BDF8] mt-0.5 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
