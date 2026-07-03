'use client'

/**
 * @컴포넌트: PricingSection
 * @설명: 랜딩 가격 섹션 (페이퍼 테마) — DB에서 조회한 전체 상품 데이터 그리드 표시.
 *        월간/연간 토글(공유), 사용자 ID → checkout URL 주입. 결제 로직은 기존과 동일.
 */

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { buildCheckoutUrl } from '@/lib/lemonsqueezy'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_BADGE_COLORS_PAPER } from '@/lib/products'
import { formatPrice } from '@/lib/price'
import QuantityStepper from '@/components/common/QuantityStepper'
import Button from '@/components/ui/Button'
import Section, { SectionHeader } from '@/components/ui/Section'

export interface PricingSectionProduct {
  name: string
  slug: string
  badgeText: string | null
  badgeColor: string
  pricingFeatures: string[]
  monthlyPrice: number
  annualPrice: number
  annualMonthlyPrice: number
  monthlyCheckoutUrl: string
  annualCheckoutUrl: string
  hasAnnualPlan: boolean
  isOneTime: boolean
  oneTimeCheckoutUrl: string
  /** 옵션 상품 여부 — true면 대표가만 노출하고 상세 페이지에서 조합 선택·구매 */
  hasOptions: boolean
}

interface Props {
  products: PricingSectionProduct[]
  affiliateRef: string
}

interface CardProps {
  product: PricingSectionProduct
  annual: boolean
  userId: string | null
  affiliateRef: string
  highlighted: boolean
}

/** 개별 상품 카드 */
function PricingCard({ product, annual, userId, affiliateRef, highlighted }: CardProps) {
  // 구매 수량 (기본 1 — 같은 상품 N개 결제, 장바구니 아님)
  const [qty, setQty] = useState(1)

  const MONTHLY        = product.monthlyPrice
  const ANNUAL         = product.annualPrice
  const ANNUAL_MONTHLY = product.annualMonthlyPrice
  const SAVE_PCT       = product.hasAnnualPlan && MONTHLY > 0
    ? Math.round((1 - ANNUAL_MONTHLY / MONTHLY) * 100)
    : 0

  const rawUrl = product.isOneTime
    ? product.oneTimeCheckoutUrl
    : annual && product.hasAnnualPlan
      ? product.annualCheckoutUrl
      : product.monthlyCheckoutUrl

  const checkoutUrl = buildCheckoutUrl(rawUrl, userId, { affiliate_ref: affiliateRef }, qty)

  return (
    <div className={`relative rounded-lg bg-paper-raised p-7 ${
      highlighted
        ? 'border-[1.5px] border-pen shadow-[0_4px_20px_rgba(29,63,176,0.10)]'
        : 'border border-rule shadow-[0_1px_2px_rgba(35,39,46,0.05)]'
    }`}>
      {highlighted && (
        <span className="absolute -top-3 left-7 inline-flex items-center rounded border-[1.5px] border-pen bg-paper px-2.5 py-0.5 font-sans text-[11px] font-bold tracking-wider text-pen">
          추천
        </span>
      )}

      {product.badgeText && (
        <div className={`inline-flex items-center gap-1.5 border rounded px-2.5 py-1 text-xs font-semibold mb-3 ${PRODUCT_BADGE_COLORS_PAPER[product.badgeColor] ?? PRODUCT_BADGE_COLORS_PAPER.blue}`}>
          {product.badgeText}
        </div>
      )}
      <p className="text-ink-soft text-sm mb-2">{product.name}</p>

      {/* 가격 — 옵션 상품은 최저가에 "부터" 표기 */}
      {product.isOneTime ? (
        <div className="flex items-end gap-2 mb-1">
          <span className="font-serif text-4xl font-black text-ink">
            {MONTHLY > 0 ? formatPrice(MONTHLY) : '—'}
          </span>
          {product.hasOptions && <span className="text-ink-soft text-sm mb-1.5">부터</span>}
        </div>
      ) : (
        <div className="flex items-end gap-2 mb-1">
          <span className="font-serif text-4xl font-black text-ink">
            {annual && product.hasAnnualPlan ? formatPrice(ANNUAL) : formatPrice(MONTHLY)}
          </span>
          {product.hasOptions && <span className="text-ink-soft text-sm mb-1.5">부터</span>}
          <span className="text-ink-soft text-base mb-1.5">
            {annual && product.hasAnnualPlan ? '/년' : '/월'}
          </span>
        </div>
      )}

      <p className="text-xs text-ink-faint mb-6">
        {product.isOneTime
          ? '1회 구매 · 평생 이용'
          : annual && product.hasAnnualPlan
            ? `월 약 ${formatPrice(ANNUAL_MONTHLY)}, 연간 결제${SAVE_PCT > 0 ? ` · ${SAVE_PCT}% 절약` : ''}`
            : product.hasAnnualPlan
              ? `월간 결제 · 또는 연 ${formatPrice(ANNUAL)}${SAVE_PCT > 0 ? ` (${SAVE_PCT}% 절약)` : ''}`
              : '월간 결제'}
        {' · VAT 포함'}
      </p>

      {/* 수량 선택 — 비옵션 상품만(옵션 상품은 상세 페이지에서 조합·수량 선택) */}
      {!product.hasOptions && <QuantityStepper value={qty} onChange={setQty} />}

      {/* CTA — 옵션 상품은 상세 페이지로 이동해 조합 선택, 비옵션은 바로 체크아웃 */}
      {product.hasOptions ? (
        <Button href={`/product/${product.slug}`} size="md" className="w-full mb-6">
          자세히 보기
        </Button>
      ) : (
        <Button href={checkoutUrl} size="md" className="w-full mb-6">
          시작하기
        </Button>
      )}

      {/* 기능 목록 — 최대 4개, 각 1줄 클램프로 카드 높이 통일(전체 설명은 상세 페이지) */}
      {product.pricingFeatures.length > 0 && (
        <ul className="flex flex-col gap-3 border-t border-rule pt-5">
          {product.pricingFeatures.slice(0, 4).map((f) => (
            <li key={f} className="flex items-center gap-3 text-sm text-ink-soft">
              <span className="w-4 h-4 rounded-full bg-pen/10 flex items-center justify-center shrink-0">
                <Check size={10} className="text-pen" />
              </span>
              <span className="line-clamp-1 min-w-0">{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function PricingSection({ products, affiliateRef }: Props) {
  const [annual, setAnnual]   = useState(false)
  const [userId, setUserId]   = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  // 상품 없으면 섹션 숨김
  if (products.length === 0) return null

  // 연간 플랜이 하나라도 있을 때만 토글 표시
  const hasAnyAnnual = products.some((p) => !p.isOneTime && p.hasAnnualPlan)

  // 상품 수에 따른 그리드 레이아웃
  const gridClass =
    products.length === 1
      ? 'max-w-sm mx-auto'
      : products.length === 2
        ? 'grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto'

  return (
    <Section id="pricing" width="wide">
      <SectionHeader label="라이선스" title="간단하고 투명한 요금제" align="center" />

      {/* 공유 토글 */}
      {hasAnyAnnual && (
        <div className="flex items-center justify-center gap-4 mb-10 -mt-4">
          <span className={`text-sm transition-colors ${!annual ? 'text-ink font-semibold' : 'text-ink-faint'}`}>
            월간
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative w-12 h-6 rounded-full transition-colors"
            style={{ backgroundColor: annual ? '#1D3FB0' : '#D8D4C8' }}
            aria-label="연간 결제 전환"
            aria-pressed={annual}
          >
            <span
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: annual ? 'translateX(28px)' : 'translateX(4px)' }}
            />
          </button>
          <span className={`text-sm transition-colors ${annual ? 'text-ink font-semibold' : 'text-ink-faint'}`}>
            연간
          </span>
        </div>
      )}

      {/* 상품 카드 그리드 */}
      <div className={gridClass}>
        {products.map((product, i) => (
          <PricingCard
            key={product.name}
            product={product}
            annual={annual}
            userId={userId}
            affiliateRef={affiliateRef}
            highlighted={i === 0}
          />
        ))}
      </div>

      <p className="text-center text-xs text-ink-faint mt-6">
        가입 시 신용카드가 필요하지 않습니다.
      </p>
    </Section>
  )
}
