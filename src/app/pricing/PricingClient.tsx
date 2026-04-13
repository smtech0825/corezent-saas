'use client'

/**
 * @컴포넌트: PricingClient
 * @설명: 요금제 페이지 인터랙티브 영역 — DB에서 가져온 제품 데이터를 렌더링
 *        - 연간/월간 결제 토글
 *        - 카테고리 필터
 *        - 로그인 사용자의 경우 checkout URL에 user_id 자동 주입
 */

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, Zap, Sparkles } from 'lucide-react'
import { BADGE_STYLES, CATEGORY_BADGE, PRODUCT_BADGE_COLORS } from '@/lib/products'
import { buildCheckoutUrl } from '@/lib/lemonsqueezy'
import { createClient } from '@/lib/supabase/client'
import { getUtmData, type UtmData } from '@/lib/cookies'

// 전역 분석 도구 타입 선언
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    posthog?: { capture: (event: string, props?: Record<string, unknown>) => void }
    fbq?: (...args: unknown[]) => void
  }
}

/** 통합 이벤트 트래킹 헬퍼 */
function track(event: string, props?: Record<string, unknown>) {
  window.gtag?.('event', event, props)
  window.posthog?.capture(event, props)
}

// ── DB에서 받는 제품 인터페이스 ──────────────────────────────────

export interface PricingProduct {
  id: string
  slug: string
  name: string
  category: string
  tagline: string
  badgeText: string | null
  badgeColor: string
  pricingFeatures: string[]
  monthlyPrice: number
  annualMonthlyPrice: number
  annualPrice: number
  monthlyCheckoutUrl: string
  annualCheckoutUrl: string
  hasAnnualPlan: boolean
  isOneTime: boolean
}

interface Props {
  products: PricingProduct[]
}

// 카테고리 필터 레이블
const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  'chrome-extension': 'Chrome Extension',
  desktop: 'Desktop',
  web: 'Web',
  'web-tool': 'Web Tool',
  mobile: 'Mobile',
}

export default function PricingClient({ products }: Props) {
  const [annual, setAnnual] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [userId, setUserId] = useState<string | null>(null)
  const [utmData, setUtmData] = useState<UtmData | null>(null)

  // 로그인 사용자 ID + UTM 데이터 조회
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
    setUtmData(getUtmData())
  }, [])

  // 카테고리 필터링
  const filtered = useMemo(
    () =>
      activeCategory === 'all'
        ? products
        : products.filter((p) => p.category === activeCategory),
    [activeCategory, products],
  )

  // 존재하는 카테고리만 탭으로 표시
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category))
    return ['all', ...cats]
  }, [products])

  const hasMultipleCategories = categories.length > 2 // 'all' + 1개 이상

  // 연간 할인이 있는 첫 번째 제품 기준 Save % 계산
  const savePct = useMemo(() => {
    const withAnnual = products.find((p) => p.hasAnnualPlan && p.monthlyPrice > 0)
    if (!withAnnual) return 0
    return Math.round((1 - withAnnual.annualMonthlyPrice / withAnnual.monthlyPrice) * 100)
  }, [products])

  // 연간 플랜이 있는 제품이 하나라도 있는지
  const hasAnyAnnualPlan = products.some((p) => p.hasAnnualPlan)

  return (
    <div className="pt-32 sm:pt-36 pb-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">

        {/* 히어로 + 토글 */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 border border-[#1E293B] bg-[#111A2E] rounded-full px-4 py-1.5 text-xs text-[#38BDF8] mb-6 font-medium">
            <Zap size={12} className="fill-[#38BDF8]" />
            Transparent pricing, no hidden fees
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-5">
            Simple pricing
          </h1>
          <p className="text-[#94A3B8] text-lg max-w-md mx-auto mb-10">
            One plan, everything included. Switch anytime.
          </p>

          {/* 월간/연간 토글 — 연간 플랜이 있는 제품이 하나라도 있을 때만 표시 */}
          {hasAnyAnnualPlan && (
            <div className="inline-flex items-center border border-[#1E293B] bg-[#111A2E] rounded-full p-1.5 gap-0.5">
              <button
                onClick={() => { setAnnual(false); track('pricing_toggle', { plan: 'monthly' }) }}
                className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  !annual ? 'bg-[#38BDF8] text-[#0B1120]' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => { setAnnual(true); track('pricing_toggle', { plan: 'annual' }) }}
                className={`whitespace-nowrap inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  annual ? 'bg-[#38BDF8] text-[#0B1120]' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Annual
                {savePct > 0 && (
                  <span
                    className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full transition-colors duration-200 ${
                      annual ? 'bg-[#0B1120]/20 text-[#0B1120]' : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    Save {savePct}%
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 카테고리 탭 */}
        {hasMultipleCategories && (
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                  activeCategory === cat
                    ? 'border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#38BDF8]'
                    : 'border-[#1E293B] text-[#94A3B8] hover:text-white'
                }`}
              >
                {FILTER_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
        )}

        {/* 제품 카드 그리드 */}
        {filtered.length === 0 ? (
          <p className="text-center text-[#94A3B8] py-20">No products in this category.</p>
        ) : (
          <div className={`grid gap-6 mb-20 ${
            filtered.length === 1
              ? 'grid-cols-1 max-w-md mx-auto'
              : filtered.length === 2
              ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}>
            {filtered.map((product, idx) => {
              const isAnnualView = annual && product.hasAnnualPlan
              const displayPrice = isAnnualView ? product.annualMonthlyPrice : product.monthlyPrice
              const baseCheckoutUrl = isAnnualView
                ? product.annualCheckoutUrl
                : product.monthlyCheckoutUrl
              const checkoutUrl = buildCheckoutUrl(baseCheckoutUrl, userId, utmData)

              // 제품별 할인율
              const productSavePct = product.hasAnnualPlan && product.monthlyPrice > 0
                ? Math.round((1 - product.annualMonthlyPrice / product.monthlyPrice) * 100)
                : 0

              return (
                <div
                  key={product.id}
                  className="group relative flex flex-col rounded-2xl border border-[#1E293B] bg-[#111A2E] p-8 hover:border-[#38BDF8]/30 transition-all duration-300"
                >
                  {/* 호버 글로우 */}
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(56,189,248,0.06), transparent)',
                    }}
                  />

                  <div className="relative z-10 flex flex-col flex-1">
                    {/* DB 뱃지 — badge_text가 있을 때만 표시 */}
                    {product.badgeText && (
                      <div className="mb-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${PRODUCT_BADGE_COLORS[product.badgeColor] ?? PRODUCT_BADGE_COLORS.blue}`}>
                          <Sparkles size={11} />
                          {product.badgeText}
                        </span>
                      </div>
                    )}

                    {/* 제품명 + 카테고리 배지 */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-2xl font-bold text-white">{product.name}</h3>
                      {product.category && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_BADGE[product.category] ?? 'bg-[#1E293B] text-[#94A3B8] border-[#1E293B]'}`}>
                          {product.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#94A3B8] leading-relaxed mb-8">{product.tagline}</p>

                    {/* 가격 */}
                    <div className="mb-8">
                      {product.isOneTime ? (
                        /* 일회성 구매 */
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-bold text-white">${product.monthlyPrice.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-[#475569] mt-1.5">One-time purchase</p>
                        </>
                      ) : (
                        /* 구독형 */
                        <>
                          {isAnnualView && (
                            <p className="text-sm text-[#94A3B8] line-through mb-0.5">
                              ${product.monthlyPrice.toFixed(2)}/mo
                            </p>
                          )}
                          <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-bold text-white">${displayPrice.toFixed(2)}</span>
                            <span className="text-[#94A3B8] text-base">/mo</span>
                          </div>
                          {product.hasAnnualPlan ? (
                            isAnnualView ? (
                              <p className="text-xs text-emerald-400 mt-1.5 font-medium">
                                Billed ${product.annualPrice}/year · Save {productSavePct}%
                              </p>
                            ) : (
                              <p className="text-xs text-[#475569] mt-1.5">
                                or ${product.annualPrice}/year (save {productSavePct}%)
                              </p>
                            )
                          ) : null}
                        </>
                      )}
                    </div>

                    {/* 구매 버튼 */}
                    <Link
                      href={userId ? checkoutUrl : '/auth/register'}
                      onClick={() => {
                        track('initiate_checkout', { product: product.name, plan: annual ? 'annual' : 'monthly' })
                        window.fbq?.('track', 'InitiateCheckout', { content_name: product.name })
                      }}
                      className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-semibold mb-8 bg-[#38BDF8] text-[#0B1120] hover:bg-[#0ea5e9] hover:shadow-[0_8px_24px_rgba(56,189,248,0.35)] hover:-translate-y-0.5 transition-all duration-200"
                    >
                      Get started
                      <ArrowRight size={14} />
                    </Link>

                    {/* 기능 목록 */}
                    {product.pricingFeatures.length > 0 && (
                      <ul className="space-y-3 flex-1">
                        {product.pricingFeatures.map((feature) => {
                          const colonIdx = feature.indexOf(':')
                          const [title, desc] = colonIdx !== -1
                            ? [feature.slice(0, colonIdx).trim(), feature.slice(colonIdx + 1).trim()]
                            : [feature, null]
                          return (
                            <li key={feature} className="flex items-start gap-3">
                              <Check size={15} className="text-[#38BDF8] mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-[#94A3B8] leading-relaxed">
                                {desc ? (
                                  <><strong className="text-[#F1F5F9]">{title}:</strong> {desc}</>
                                ) : title}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
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
