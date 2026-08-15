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
import ProcurementBadge from '@/components/common/ProcurementBadge'
import Button from '@/components/ui/Button'
import Section, { SectionHeader } from '@/components/ui/Section'
import { EVENT, trackEvent } from '@/lib/analytics-events'

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
  /** 조달청 물품분류번호(054) — 비면 배지 미표시 */
  procurementClassNumber: string | null
  /** 조달청 물품식별번호(054) — 비면 배지 미표시 */
  procurementItemNumber: string | null
}

interface Props {
  products: PricingSectionProduct[]
  affiliateRef: string
  /** 대표 제품 하나만 보여주는 모드일 때 true — 카드 아래에 「요금 보기」 버튼을 붙인다 */
  showViewPricing?: boolean
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
    // flex-col + 하단 그룹 mt-auto — 수량칸 유무·설명 길이가 달라도 CTA 버튼 줄이 카드 맨 아래로 정렬된다
    <div className={`relative flex flex-col rounded-lg bg-paper-raised p-7 ${
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

      {/* 기능 목록 — 최대 4개, 각 3줄까지(전체 설명은 상세 페이지). 카드 높이는 그리드 stretch로 통일 */}
      {product.pricingFeatures.length > 0 && (
        <ul className="flex flex-col gap-3 border-t border-rule pt-5">
          {/* 여러 줄 표시라 아이콘은 첫 줄에 상단 정렬(items-start + mt) */}
          {product.pricingFeatures.slice(0, 4).map((f) => (
            <li key={f} className="flex items-start gap-3 text-sm text-ink-soft">
              <span className="w-4 h-4 rounded-full bg-pen/10 flex items-center justify-center shrink-0 mt-0.5">
                <Check size={10} className="text-pen" />
              </span>
              <span className="line-clamp-3 min-w-0" title={f}>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 하단 그룹 — mt-auto로 카드 맨 아래 고정(pt-6은 위 내용과의 최소 간격).
          그룹 높이는 수량칸·조달 배지 유무로 카드마다 다르다 — 버튼 줄이 맞는 이유는
          '높이가 같아서'가 아니라 그룹의 마지막 자식(버튼)이 카드 바닥에 붙기 때문 */}
      <div className="mt-auto pt-6">
        {/* 수량 선택 — 비옵션 상품만(옵션 상품은 상세 페이지에서 조합·수량 선택) */}
        {!product.hasOptions && <QuantityStepper value={qty} onChange={setQty} />}

        {/* 조달청 등록번호 — CTA 버튼 위(자세히 보기·시작하기 두 경우 모두 공통).
            값이 없으면 부품이 null이라 자리·여백이 남지 않는다(여백은 배지 자체에 준다) */}
        <ProcurementBadge
          classNumber={product.procurementClassNumber}
          itemNumber={product.procurementItemNumber}
          size="sm"
          className="mb-3"
        />

        {/* CTA — 옵션 상품은 상세 페이지로 이동해 조합 선택, 비옵션은 바로 체크아웃 */}
        {product.hasOptions ? (
          <Button href={`/product/${product.slug}`} size="md" className="w-full">
            자세히 보기
          </Button>
        ) : (
          // 결제 시작 측정 — 공용 Button(링크 분기)은 onClick을 받지 않으므로 감싼 요소의
          // 클릭(버블링)으로 잡는다. 상품명·자리뿐, 개인정보 없음. 실패해도 이동은 진행
          <span
            className="block"
            onClick={() => trackEvent(EVENT.BEGIN_CHECKOUT, { product: product.name, method: 'card', placement: 'home' })}
          >
            <Button href={checkoutUrl} size="md" className="w-full">
              시작하기
            </Button>
          </span>
        )}
      </div>
    </div>
  )
}

export default function PricingSection({ products, affiliateRef, showViewPricing = false }: Props) {
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
            style={{ backgroundColor: annual ? 'var(--color-pen)' : 'var(--color-rule)' }}
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

      {/* 대표 제품 모드에서만 — 전체 요금은 요금 페이지에서. 버튼은 기존 outline 방식 그대로 */}
      {showViewPricing && (
        <div className="flex justify-center mt-8">
          <Button href="/pricing" variant="outline" size="md">
            요금 보기
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-ink-faint mt-6">
        가입 시 신용카드가 필요하지 않습니다.
      </p>
    </Section>
  )
}
