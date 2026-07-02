'use client'

/**
 * @컴포넌트: OptionProductCard
 * @설명: 옵션 진열 카드 — 같은 option_group으로 묶인 조합 상품들을 카드 1개로 표시.
 *        축1·축2 드롭다운(등록 라벨에서 자동 생성) + 수량 선택 → 선택 조합의 상품으로
 *        가격을 즉시 갱신하고, 그 상품의 checkout_url로 구매 버튼을 연결한다.
 *        결제·slug·라이선스와 무관한 순수 표시 계층 — 각 조합은 여전히 개별 DB 상품.
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, Sparkles } from 'lucide-react'
import { PRODUCT_BADGE_COLORS } from '@/lib/products'
import { formatPrice } from '@/lib/price'
import { buildCheckoutUrl } from '@/lib/lemonsqueezy'
import QuantityStepper from '@/components/common/QuantityStepper'
import type { UtmData } from '@/lib/cookies'
import type { PricingProduct } from './PricingClient'

interface Props {
  products: PricingProduct[]   // 같은 option_group 조합 상품들 (등록 순서 유지)
  userId: string | null
  affiliateRef: string
  utmData: UtmData | null
  discountCode: string
  onCheckout?: (product: PricingProduct, quantity: number) => void
}

/** 중복 제거 + 첫 등장 순서 유지 */
function uniqueInOrder(values: (string | null)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    if (v && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

export default function OptionProductCard({ products, userId, affiliateRef, utmData, discountCode, onCheckout }: Props) {
  // 축별 옵션 라벨 (등록 순서, 중복 제거)
  const axis1Options = useMemo(() => uniqueInOrder(products.map((p) => p.axis1Label)), [products])
  const axis2Options = useMemo(() => uniqueInOrder(products.map((p) => p.axis2Label)), [products])
  const hasAxis2 = axis2Options.length > 0

  // 기본 선택: 첫 유효 조합(등록 순서 첫 상품)
  const first = products[0]
  const [a1, setA1] = useState(first?.axis1Label ?? '')
  const [a2, setA2] = useState(first?.axis2Label ?? '')
  const [qty, setQty] = useState(1)

  /** (a1, a2) 조합에 해당하는 상품 찾기 (축2 미사용이면 a1만) */
  function findProduct(x1: string, x2: string): PricingProduct | undefined {
    return products.find(
      (p) => (p.axis1Label ?? '') === x1 && (hasAxis2 ? (p.axis2Label ?? '') === x2 : true),
    )
  }

  /** 특정 a1에서 등록된 a2 라벨 집합 (미등록 조합 비활성화용) */
  function validAxis2For(x1: string): Set<string> {
    return new Set(
      products.filter((p) => (p.axis1Label ?? '') === x1 && p.axis2Label).map((p) => p.axis2Label as string),
    )
  }

  // 축1 변경 시 현재 a2가 그 조합에 없으면 첫 유효 a2로 자동 보정
  function changeA1(next: string) {
    setA1(next)
    if (hasAxis2) {
      const valid = validAxis2For(next)
      if (!valid.has(a2)) {
        const firstValid = axis2Options.find((o) => valid.has(o))
        if (firstValid) setA2(firstValid)
      }
    }
  }

  const selected = useMemo(() => findProduct(a1, a2) ?? first, [a1, a2, products]) // eslint-disable-line react-hooks/exhaustive-deps
  const validA2 = useMemo(() => validAxis2For(a1), [a1, products]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayPrice = selected.unitPrice * qty
  const checkoutUrl = buildCheckoutUrl(
    selected.unitCheckoutUrl,
    userId,
    { ...utmData, affiliate_ref: affiliateRef },
    qty,
    discountCode,
  )

  return (
    <div className="group relative flex flex-col rounded-2xl border border-[#1E293B] bg-[#111A2E] p-8 hover:border-[#38BDF8]/30 transition-all duration-300">
      {/* 호버 글로우 */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(56,189,248,0.06), transparent)' }}
      />

      <div className="relative z-10 flex flex-col flex-1">
        {/* 뱃지 (선택 조합 기준) */}
        {selected.badgeText && (
          <div className="mb-4">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${PRODUCT_BADGE_COLORS[selected.badgeColor] ?? PRODUCT_BADGE_COLORS.blue}`}>
              <Sparkles size={11} />
              {selected.badgeText}
            </span>
          </div>
        )}

        {/* 제품명 (선택 조합) */}
        <h3 className="text-2xl font-bold text-white mb-2">{selected.name}</h3>
        <p className="text-sm text-[#94A3B8] leading-relaxed mb-6">{selected.tagline}</p>

        {/* 옵션 드롭다운 */}
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1.5">{selected.axis1Name ?? '옵션'}</label>
            <select
              value={a1}
              onChange={(e) => changeA1(e.target.value)}
              className="w-full bg-[#0B1120] border border-[#1E293B] text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#38BDF8]/50 cursor-pointer"
            >
              {axis1Options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {hasAxis2 && (
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1.5">{selected.axis2Name ?? '옵션'}</label>
              <select
                value={a2}
                onChange={(e) => setA2(e.target.value)}
                className="w-full bg-[#0B1120] border border-[#1E293B] text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#38BDF8]/50 cursor-pointer"
              >
                {axis2Options.map((opt) => (
                  <option key={opt} value={opt} disabled={!validA2.has(opt)}>
                    {opt}{validA2.has(opt) ? '' : ' (미출시)'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 수량 */}
        <QuantityStepper value={qty} onChange={setQty} />

        {/* 가격 — 조합 단가 × 수량 즉시 갱신 */}
        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-white">{formatPrice(displayPrice)}</span>
            {selected.priceSuffix && <span className="text-[#94A3B8] text-base">{selected.priceSuffix}</span>}
          </div>
          <p className="text-xs text-[#475569] mt-1.5">
            {qty > 1 ? `${formatPrice(selected.unitPrice)}${selected.priceSuffix} × ${qty} · ` : ''}VAT 포함
          </p>
        </div>

        {/* 구매 버튼 */}
        <Link
          href={userId ? checkoutUrl : '/auth/register'}
          onClick={() => onCheckout?.(selected, qty)}
          className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-semibold mb-8 bg-[#38BDF8] text-[#0B1120] hover:bg-[#0ea5e9] hover:shadow-[0_8px_24px_rgba(56,189,248,0.35)] hover:-translate-y-0.5 transition-all duration-200"
        >
          시작하기
          <ArrowRight size={14} />
        </Link>

        {/* 기능 목록 (선택 조합) */}
        {selected.pricingFeatures.length > 0 && (
          <ul className="space-y-3 flex-1">
            {selected.pricingFeatures.map((feature) => {
              const colonIdx = feature.indexOf(':')
              const [title, desc] = colonIdx !== -1
                ? [feature.slice(0, colonIdx).trim(), feature.slice(colonIdx + 1).trim()]
                : [feature, null]
              return (
                <li key={feature} className="flex items-start gap-3">
                  <Check size={15} className="text-[#38BDF8] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-[#94A3B8] leading-relaxed">
                    {desc ? (<><strong className="text-[#F1F5F9]">{title}:</strong> {desc}</>) : title}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
