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
import { Check, ArrowRight, Zap, Sparkles, Tag, X } from 'lucide-react'
import { CATEGORY_BADGE_PAPER, PRODUCT_BADGE_COLORS_PAPER } from '@/lib/products'
import { formatPrice } from '@/lib/price'
import { buildCheckoutUrl } from '@/lib/lemonsqueezy'
import { createClient } from '@/lib/supabase/client'
import { getUtmData, type UtmData } from '@/lib/cookies'
import QuantityStepper from '@/components/common/QuantityStepper'
import OptionProductCard from './OptionProductCard'

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
  // 옵션 진열(039) — optionGroup이 있으면 같은 값끼리 카드 1개로 묶여 드롭다운 선택기가 된다
  optionGroup: string | null
  axis1Name: string | null
  axis1Label: string | null
  axis2Name: string | null
  axis2Label: string | null
  unitPrice: number          // 이 조합의 결제 단가
  unitCheckoutUrl: string    // 이 조합의 checkout_url
  priceSuffix: string        // '/월' | '/년' | '' (일회성)
}

interface Props {
  products: PricingProduct[]
  affiliateRef: string
}

// 카드 렌더 단위 — 옵션 묶음(group) 또는 단독 상품(single)
type RenderUnit =
  | { type: 'group'; key: string; items: PricingProduct[] }
  | { type: 'single'; key: string; product: PricingProduct }

// 카테고리 필터 레이블
const FILTER_LABELS: Record<string, string> = {
  all: '전체',
  'chrome-extension': '크롬 확장프로그램',
  desktop: '데스크톱',
  web: '웹',
  'web-tool': '웹 도구',
  mobile: '모바일',
}

export default function PricingClient({ products, affiliateRef }: Props) {
  const [annual, setAnnual] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [userId, setUserId] = useState<string | null>(null)
  const [utmData, setUtmData] = useState<UtmData | null>(null)
  // 상품별 구매 수량 (기본 1 — 같은 상품 N개 결제, 장바구니 아님)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  // LS 할인코드 — 모든 카드의 체크아웃 URL에 checkout[discount_code]로 전달 (검증·계산은 LS)
  const [discountCode, setDiscountCode] = useState('')

  // 로그인 사용자 ID + UTM 데이터 조회 + 할인코드 URL 프리필(?discount=CODE)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
    setUtmData(getUtmData())
    const urlCode = new URLSearchParams(window.location.search).get('discount')
    if (urlCode) setDiscountCode(urlCode.trim().slice(0, 64))
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

  // 렌더 유닛: option_group이 같은 상품들은 카드 1개(group)로 묶고, 나머지는 개별(single).
  // 첫 등장 위치에 그룹 카드를 두어 등록 순서(order_index)를 유지한다.
  const renderUnits = useMemo<RenderUnit[]>(() => {
    const units: RenderUnit[] = []
    const groupIdx = new Map<string, number>()
    for (const p of filtered) {
      if (p.optionGroup) {
        const gi = groupIdx.get(p.optionGroup)
        if (gi === undefined) {
          groupIdx.set(p.optionGroup, units.length)
          units.push({ type: 'group', key: p.optionGroup, items: [p] })
        } else {
          (units[gi] as { items: PricingProduct[] }).items.push(p)
        }
      } else {
        units.push({ type: 'single', key: p.id, product: p })
      }
    }
    return units
  }, [filtered])

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

          {/* 할인코드 입력 — 모든 카드의 체크아웃 URL에 checkout[discount_code]로 전달 */}
          <div className="mt-6">
            <div className="inline-flex items-center gap-2 border border-rule bg-paper-raised rounded-full px-4 py-2">
              <Tag size={13} className="text-pen shrink-0" />
              <input
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="할인코드 (선택)"
                className="bg-transparent text-sm text-ink placeholder-ink-faint focus:outline-none w-36"
              />
              {discountCode && (
                <button
                  type="button"
                  onClick={() => setDiscountCode('')}
                  aria-label="할인코드 지우기"
                  className="text-ink-faint hover:text-ink transition-colors cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {discountCode.trim() && (
              <p className="text-xs text-pen mt-2">
                결제 화면에서 자동 입력됩니다 (할인 금액·유효성은 결제 화면에서 확인)
              </p>
            )}
          </div>
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
            renderUnits.length === 1
              ? 'grid-cols-1 max-w-md mx-auto'
              : renderUnits.length === 2
              ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}>
            {renderUnits.map((unit) => {
              // 옵션 묶음 카드 — 축 드롭다운 + 수량 + 조합별 가격/checkout
              if (unit.type === 'group') {
                return (
                  <OptionProductCard
                    key={unit.key}
                    products={unit.items}
                    userId={userId}
                    affiliateRef={affiliateRef}
                    utmData={utmData}
                    discountCode={discountCode}
                    onCheckout={(prod, q) => {
                      track('initiate_checkout', { product: prod.name, quantity: q })
                      window.fbq?.('track', 'InitiateCheckout', { content_name: prod.name })
                    }}
                  />
                )
              }
              const product = unit.product
              const isAnnualView = annual && product.hasAnnualPlan
              const displayPrice = isAnnualView ? product.annualMonthlyPrice : product.monthlyPrice
              const baseCheckoutUrl = isAnnualView
                ? product.annualCheckoutUrl
                : product.monthlyCheckoutUrl
              const quantity = quantities[product.id] ?? 1
              const checkoutUrl = buildCheckoutUrl(baseCheckoutUrl, userId, { ...utmData, affiliate_ref: affiliateRef }, quantity, discountCode)

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
                    <p className="text-sm text-ink-soft leading-relaxed mb-8">{product.tagline}</p>

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

                    {/* 수량 선택 — 같은 상품 N개 결제 (LS quantity 파라미터로 전달) */}
                    <QuantityStepper
                      value={quantity}
                      onChange={(next) => setQuantities((prev) => ({ ...prev, [product.id]: next }))}
                    />

                    {/* 구매 버튼 */}
                    <Link
                      href={userId ? checkoutUrl : '/auth/register'}
                      onClick={() => {
                        track('initiate_checkout', { product: product.name, plan: annual ? 'annual' : 'monthly', quantity })
                        window.fbq?.('track', 'InitiateCheckout', { content_name: product.name })
                      }}
                      className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-md text-sm font-semibold mb-8 bg-pen text-white hover:bg-pen-dark hover:shadow-[0_8px_24px_rgba(29,63,176,0.25)] hover:-translate-y-0.5 transition-all duration-200"
                    >
                      시작하기
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
                              <Check size={15} className="text-pen mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-ink-soft leading-relaxed">
                                {desc ? (
                                  <><strong className="text-ink">{title}:</strong> {desc}</>
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
