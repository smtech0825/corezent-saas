'use client'

/**
 * @컴포넌트: PricingClient
 * @설명: 요금제 페이지 인터랙티브 영역
 *        - 연간/월간 결제 토글
 *        - 제품 카드 그리드
 *        - 로그인 사용자의 경우 checkout URL에 user_id 자동 주입
 */

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, Zap } from 'lucide-react'
import {
  products,
  FILTER_LABELS,
  BADGE_STYLES,
  CATEGORY_BADGE,
  type FilterCategory,
} from '@/lib/products'
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

interface DbProductData {
  tags: string[]
  pricing_features: string[]
}

interface Props {
  dbData: Record<string, DbProductData>
}

const FILTER_CATEGORIES: FilterCategory[] = ['all', 'chrome-extension', 'desktop', 'web-tool']

// 연간 절약률 계산 (첫 번째 제품 기준)
const SAVE_PCT = products[0]
  ? Math.round((1 - products[0].annualMonthlyPrice / products[0].monthlyPrice) * 100)
  : 25

export default function PricingClient({ dbData }: Props) {
  const [annual, setAnnual] = useState(false)
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all')
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

  const filtered = useMemo(
    () =>
      activeCategory === 'all'
        ? products
        : products.filter((p) => p.category === activeCategory),
    [activeCategory],
  )

  const hasMultipleCategories = new Set(products.map((p) => p.category)).size > 1

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

          {/* 월간/연간 토글 — transition-colors만 사용해 레이아웃 겹침 방지 */}
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
              <span
                className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full transition-colors duration-200 ${
                  annual ? 'bg-[#0B1120]/20 text-[#0B1120]' : 'bg-emerald-500/15 text-emerald-400'
                }`}
              >
                Save {SAVE_PCT}%
              </span>
            </button>
          </div>
        </div>

        {/* 카테고리 탭 (제품이 여러 카테고리일 때만 표시) */}
        {hasMultipleCategories && (
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
        )}

        {/* 제품 카드 그리드 */}
        {filtered.length === 0 ? (
          <p className="text-center text-[#94A3B8] py-20">No products in this category.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {filtered.map((product) => {
              const price = annual ? product.annualMonthlyPrice : product.monthlyPrice
              const checkoutUrl = buildCheckoutUrl(
                annual ? product.lemonSqueezy.annual : product.lemonSqueezy.monthly,
                userId,
                utmData,
              )
              // DB 데이터에서 pricing_features 조회
              const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
              const db = dbData[slug]
              const displayFeatures = db?.pricing_features?.length ? db.pricing_features : product.features
              // 제품별 정확한 할인율 계산 (소수점 반올림)
              const savePct = Math.round((1 - product.annualMonthlyPrice / product.monthlyPrice) * 100)

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
                    {/* 뱃지 */}
                    {product.badge && (
                      <div className="mb-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            BADGE_STYLES[product.badge] ?? 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/20'
                          }`}
                        >
                          {product.badge}
                        </span>
                      </div>
                    )}

                    {/* 제품명 + 카테고리 배지 + 태그라인 */}
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
                      {annual && (
                        <p className="text-sm text-[#94A3B8] line-through mb-0.5">
                          ${product.monthlyPrice.toFixed(2)}/mo
                        </p>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-bold text-white">${price.toFixed(2)}</span>
                        <span className="text-[#94A3B8] text-base">/mo</span>
                      </div>
                      {annual ? (
                        <p className="text-xs text-emerald-400 mt-1.5 font-medium">
                          Billed ${product.annualPrice}/year · Save {savePct}%
                        </p>
                      ) : (
                        <p className="text-xs text-[#475569] mt-1.5">
                          or ${product.annualPrice}/year (save {savePct}%)
                        </p>
                      )}
                    </div>

                    {/* 구매 버튼 — 비로그인 시 회원가입 페이지로 이동 */}
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

                    {/* 기능 목록 (DB pricing_features 우선, 없으면 하드코딩 features 사용) */}
                    <ul className="space-y-3 flex-1">
                      {displayFeatures.map((feature) => {
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
