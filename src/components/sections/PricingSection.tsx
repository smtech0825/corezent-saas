'use client'

/**
 * @컴포넌트: PricingSection
 * @설명: 랜딩 페이지 가격 섹션 — DB에서 조회한 전체 상품 데이터 그리드 표시
 *        월간/연간 토글(공유), 사용자 ID → checkout URL에 주입
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, Sparkles } from 'lucide-react'
import { buildCheckoutUrl } from '@/lib/lemonsqueezy'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_BADGE_COLORS } from '@/lib/products'

export interface PricingSectionProduct {
  name: string
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
}

interface Props {
  products: PricingSectionProduct[]
}

interface CardProps {
  product: PricingSectionProduct
  annual: boolean
  userId: string | null
  highlighted: boolean
}

/** 개별 상품 카드 */
function PricingCard({ product, annual, userId, highlighted }: CardProps) {
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

  const checkoutUrl = buildCheckoutUrl(rawUrl, userId)

  return (
    <div className={`relative border rounded-2xl p-8 overflow-hidden ${
      highlighted
        ? 'border-[#38BDF8]/50 bg-[#111A2E]'
        : 'border-[#38BDF8]/25 bg-[#111A2E]'
    }`}>
      {/* Corner glow */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.12]"
        style={{ background: 'radial-gradient(circle, #38BDF8, transparent)' }}
      />

      <div className="relative z-10">
        {product.badgeText && (
          <div className={`inline-flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs font-semibold mb-3 ${PRODUCT_BADGE_COLORS[product.badgeColor] ?? PRODUCT_BADGE_COLORS.blue}`}>
            <Sparkles size={11} />
            {product.badgeText}
          </div>
        )}
        <p className="text-[#94A3B8] text-sm mb-2">{product.name}</p>

        {/* 가격 */}
        {product.isOneTime ? (
          <div className="flex items-end gap-2 mb-1">
            <span className="text-5xl font-bold text-white">
              ${MONTHLY > 0 ? MONTHLY.toFixed(2) : '—'}
            </span>
          </div>
        ) : (
          <div className="flex items-end gap-2 mb-1">
            <span className="text-5xl font-bold text-white">
              {annual && product.hasAnnualPlan
                ? `$${ANNUAL}`
                : `$${MONTHLY.toFixed(2)}`}
            </span>
            <span className="text-[#94A3B8] text-base mb-2">
              {annual && product.hasAnnualPlan ? '/년' : '/월'}
            </span>
          </div>
        )}

        <p className="text-xs text-[#475569] mb-7">
          {product.isOneTime
            ? '1회 구매 · 평생 이용'
            : annual && product.hasAnnualPlan
              ? `월 약 $${ANNUAL_MONTHLY.toFixed(2)}, 연간 결제${SAVE_PCT > 0 ? ` · ${SAVE_PCT}% 절약` : ''}`
              : product.hasAnnualPlan
                ? `월간 결제 · 또는 연 $${ANNUAL}${SAVE_PCT > 0 ? ` (${SAVE_PCT}% 절약)` : ''}`
                : '월간 결제'}
        </p>

        {/* CTA */}
        <Link
          href={checkoutUrl}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold py-3.5 rounded-xl text-sm hover:bg-[#0ea5e9] transition-all duration-200 hover:-translate-y-0.5 mb-7"
        >
          시작하기
          <ArrowRight size={15} />
        </Link>

        {/* 기능 목록 */}
        {product.pricingFeatures.length > 0 && (
          <ul className="flex flex-col gap-3">
            {product.pricingFeatures.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-[#94A3B8]">
                <span className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Check size={10} className="text-emerald-400" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function PricingSection({ products }: Props) {
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
        ? 'grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto'

  return (
    <section id="pricing" className="relative py-32 px-6">
      {/* Center glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(56,189,248,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-[#38BDF8] text-sm font-semibold tracking-widest uppercase mb-4">
            요금제
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            간단하고 정직한 요금제.
          </h2>
          <p className="text-[#94A3B8] text-lg max-w-xl mx-auto">
            하나의 플랜. 모든 기능 포함. 언제든 해지 가능.
          </p>
        </div>

        {/* 공유 토글 — 연간 플랜이 있는 구독 상품이 하나라도 있을 때만 표시 */}
        {hasAnyAnnual && (
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-sm transition-colors ${!annual ? 'text-white font-medium' : 'text-[#94A3B8]'}`}>
              월간
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              className="relative w-12 h-6 rounded-full transition-colors overflow-hidden"
              style={{ backgroundColor: annual ? '#38BDF8' : '#1E293B' }}
              aria-label="연간 결제 전환"
            >
              <span
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                style={{ transform: annual ? 'translateX(28px)' : 'translateX(4px)' }}
              />
            </button>
            <span className={`text-sm transition-colors ${annual ? 'text-white font-medium' : 'text-[#94A3B8]'}`}>
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
              highlighted={i === 0}
            />
          ))}
        </div>

        <p className="text-center text-xs text-[#475569] mt-6">
          가입 시 신용카드가 필요하지 않습니다.
        </p>
      </div>
    </section>
  )
}
