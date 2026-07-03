'use client'

/**
 * @컴포넌트: PricingClient
 * @설명: 요금제 페이지 인터랙티브 영역 — DB에서 가져온 제품 데이터를 렌더링
 *        - 연간/월간 결제 토글
 *        - 카테고리 필터
 *        - 로그인 사용자의 경우 checkout URL에 user_id 자동 주입
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, Zap, Sparkles } from 'lucide-react'
import { CATEGORY_BADGE_PAPER, PRODUCT_BADGE_COLORS_PAPER } from '@/lib/products'
import { formatPrice } from '@/lib/price'

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
  // v2 옵션 — 축 제목(products) + 옵션 행(product_prices). optionRows 2+면 드롭다운 카드.
  axis1Name: string | null
  axis2Name: string | null
  optionRows: OptionRow[]
}

// 옵션 행 하나(= product_prices 한 행) — 라벨·가격·checkout·주기 접미
export interface OptionRow {
  axis1Label: string | null
  axis2Label: string | null
  price: number
  checkoutUrl: string
  suffix: string   // '/월' | '/년' | '' (일회성)
}

interface Props {
  products: PricingProduct[]
}

// 카테고리 필터 레이블
const FILTER_LABELS: Record<string, string> = {
  all: '전체',
  'chrome-extension': '크롬 확장프로그램',
  desktop: '데스크톱',
  web: '웹',
  'web-tool': '웹 도구',
  mobile: '모바일',
}

export default function PricingClient({ products }: Props) {
  const [annual, setAnnual] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')

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
    <div className="pt-10 sm:pt-14 pb-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">

        {/* 히어로 + 토글 */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 border border-rule bg-paper-raised rounded-full px-4 py-1.5 text-xs text-pen mb-6 font-medium">
            <Zap size={12} className="fill-pen" />
            투명한 요금제, 숨겨진 비용 없음
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-black text-ink leading-tight mb-5">
            간단한 요금제
          </h1>
          <p className="text-ink-soft text-lg max-w-md mx-auto mb-10">
            하나의 플랜, 모든 기능 포함. 언제든 변경 가능.
          </p>

          {/* 월간/연간 토글 — 연간 플랜이 있는 제품이 하나라도 있을 때만 표시 */}
          {hasAnyAnnualPlan && (
            <div className="inline-flex items-center border border-rule bg-paper-raised rounded-full p-1.5 gap-0.5">
              <button
                onClick={() => { setAnnual(false); track('pricing_toggle', { plan: 'monthly' }) }}
                className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  !annual ? 'bg-pen text-white' : 'text-ink-soft hover:text-ink'
                }`}
              >
                월간
              </button>
              <button
                onClick={() => { setAnnual(true); track('pricing_toggle', { plan: 'annual' }) }}
                className={`whitespace-nowrap inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  annual ? 'bg-pen text-white' : 'text-ink-soft hover:text-ink'
                }`}
              >
                연간
                {savePct > 0 && (
                  <span
                    className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full transition-colors duration-200 ${
                      annual ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {savePct}% 절약
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
                    ? 'border-pen/40 bg-pen/5 text-pen'
                    : 'border-rule text-ink-soft hover:text-ink'
                }`}
              >
                {FILTER_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
        )}

        {/* 제품 카드 그리드 */}
        {filtered.length === 0 ? (
          <p className="text-center text-ink-soft py-20">이 카테고리에 제품이 없습니다.</p>
        ) : (
          <div className={`grid gap-6 mb-20 ${
            filtered.length === 1
              ? 'grid-cols-1 max-w-md mx-auto'
              : filtered.length === 2
              ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}>
            {filtered.map((product) => {
              // 옵션 행이 2개 이상이면 = 옵션 상품 → 카드엔 "부터" 대표가만, 실제 선택·구매는 상세 페이지에서.
              const hasOptions = product.optionRows.length >= 2
              const isAnnualView = annual && product.hasAnnualPlan
              const displayPrice = isAnnualView ? product.annualMonthlyPrice : product.monthlyPrice

              // 제품별 할인율
              const productSavePct = product.hasAnnualPlan && product.monthlyPrice > 0
                ? Math.round((1 - product.annualMonthlyPrice / product.monthlyPrice) * 100)
                : 0

              return (
                <div
                  key={product.id}
                  className="group relative flex flex-col rounded-lg border border-rule bg-paper-raised p-8 shadow-[0_1px_2px_rgba(35,39,46,0.05)] hover:border-ink-faint hover:shadow-[0_6px_20px_rgba(35,39,46,0.08)] transition-all duration-300"
                >
                  {/* 호버 글로우 */}
                  <div
                    className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(29,63,176,0.04), transparent)',
                    }}
                  />

                  <div className="relative z-10 flex flex-col flex-1">
                    {/* DB 뱃지 — badge_text가 있을 때만 표시 */}
                    {product.badgeText && (
                      <div className="mb-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${PRODUCT_BADGE_COLORS_PAPER[product.badgeColor] ?? PRODUCT_BADGE_COLORS_PAPER.blue}`}>
                          <Sparkles size={11} />
                          {product.badgeText}
                        </span>
                      </div>
                    )}

                    {/* 제품명 + 카테고리 배지 */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-2xl font-bold text-ink">{product.name}</h3>
                      {product.category && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_BADGE_PAPER[product.category] ?? 'bg-paper-shade text-ink-soft border-rule'}`}>
                          {FILTER_LABELS[product.category] ?? product.category}
                        </span>
                      )}
                    </div>
                    {/* 태그라인 — 2줄 클램프 + min-height로 카드 간 가격 시작선을 맞춘다(빈 값이어도 영역 유지) */}
                    <p className="text-sm text-ink-soft leading-relaxed mb-8 line-clamp-2 min-h-[2.75rem]">
                      {product.tagline}
                    </p>

                    {/* 가격 — 숫자는 헤드라인, "VAT 포함"은 아래 안내 문구로 분리 */}
                    <div className="mb-8">
                      {product.isOneTime ? (
                        /* 일회성 구매 */
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-ink">{formatPrice(product.monthlyPrice)}</span>
                          </div>
                          <p className="text-xs text-ink-faint mt-1.5">1회 구매 · VAT 포함</p>
                        </>
                      ) : (
                        /* 구독형 */
                        <>
                          {isAnnualView && (
                            <p className="text-sm text-ink-faint line-through mb-0.5">
                              {formatPrice(product.monthlyPrice)}/월
                            </p>
                          )}
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-ink">{formatPrice(displayPrice)}</span>
                            {hasOptions && <span className="text-ink-soft text-sm">부터</span>}
                            <span className="text-ink-soft text-base">/월</span>
                          </div>
                          {product.hasAnnualPlan ? (
                            isAnnualView ? (
                              <p className="text-xs text-emerald-700 mt-1.5 font-medium">
                                연 {formatPrice(product.annualPrice)} 결제 · {productSavePct}% 절약 · VAT 포함
                              </p>
                            ) : (
                              <p className="text-xs text-ink-faint mt-1.5">
                                또는 연 {formatPrice(product.annualPrice)} ({productSavePct}% 절약) · VAT 포함
                              </p>
                            )
                          ) : (
                            <p className="text-xs text-ink-faint mt-1.5">VAT 포함</p>
                          )}
                        </>
                      )}
                    </div>

                    {/* 핵심 기능 — 최대 4개, 각 1줄 클램프(전체 설명은 상세 페이지에서). 카드 높이 통일 */}
                    {product.pricingFeatures.length > 0 && (
                      <ul className="space-y-3 mb-6">
                        {product.pricingFeatures.slice(0, 4).map((feature) => {
                          const colonIdx = feature.indexOf(':')
                          const [title, desc] = colonIdx !== -1
                            ? [feature.slice(0, colonIdx).trim(), feature.slice(colonIdx + 1).trim()]
                            : [feature, null]
                          return (
                            <li key={feature} className="flex items-start gap-3">
                              <Check size={15} className="text-pen mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-ink-soft leading-relaxed line-clamp-1 min-w-0">
                                {desc ? (
                                  <><strong className="text-ink">{title}:</strong> {desc}</>
                                ) : title}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}

                    {/* 하단 고정 영역 — CTA를 카드 맨 아래로 정렬(mt-auto).
                        전 상품 공통: 상세 페이지로 이동해 옵션·수량 선택 후 구매(구매 바) */}
                    <div className="mt-auto">
                      <Link
                        href={`/product/${product.slug}`}
                        onClick={() => track('view_product', { product: product.name, has_options: hasOptions })}
                        className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-md text-sm font-semibold bg-pen text-white hover:bg-pen-dark hover:shadow-[0_8px_24px_rgba(29,63,176,0.25)] hover:-translate-y-0.5 transition-all duration-200"
                      >
                        자세히 보기
                        <ArrowRight size={14} />
                      </Link>
                    </div>
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
