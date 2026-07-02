'use client'

/**
 * @컴포넌트: OptionProductCard
 * @설명: 옵션 있는 상품 카드 — 상품 1개 + product_prices 옵션 행 배열(product.optionRows).
 *        축1·축2 드롭다운(옵션 행 라벨에서 자동 생성) + 수량 → 선택 조합 행의 가격×수량 즉시 갱신,
 *        그 행의 checkout_url로 구매 버튼 연결. 결제·라이선스와 무관한 순수 표시 계층.
 *        (표준 쇼핑몰 구조 v2 — 각 옵션은 같은 상품의 가격 행)
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Check, ArrowRight, Sparkles } from 'lucide-react'
import { PRODUCT_BADGE_COLORS_PAPER } from '@/lib/products'
import { formatPrice } from '@/lib/price'
import { buildCheckoutUrl } from '@/lib/lemonsqueezy'
import QuantityStepper from '@/components/common/QuantityStepper'
import type { UtmData } from '@/lib/cookies'
import type { PricingProduct } from './PricingClient'

interface Props {
  product: PricingProduct       // 공통 정보 + optionRows (길이 2+)
  userId: string | null
  affiliateRef: string
  utmData: UtmData | null
  discountCode: string
  onCheckout?: (quantity: number) => void
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

export default function OptionProductCard({ product, userId, affiliateRef, utmData, discountCode, onCheckout }: Props) {
  const rows = product.optionRows

  // 축별 옵션 라벨 (등록 순서, 중복 제거)
  const axis1Options = useMemo(() => uniqueInOrder(rows.map((r) => r.axis1Label)), [rows])
  const axis2Options = useMemo(() => uniqueInOrder(rows.map((r) => r.axis2Label)), [rows])
  const hasAxis2 = axis2Options.length > 0

  // 기본 선택: 첫 옵션 행
  const first = rows[0]
  const [a1, setA1] = useState(first?.axis1Label ?? '')
  const [a2, setA2] = useState(first?.axis2Label ?? '')
  const [qty, setQty] = useState(1)

  /** (a1, a2) 조합에 해당하는 옵션 행 찾기 (축2 미사용이면 a1만) */
  function findRow(x1: string, x2: string) {
    return rows.find(
      (r) => (r.axis1Label ?? '') === x1 && (hasAxis2 ? (r.axis2Label ?? '') === x2 : true),
    )
  }

  /** 특정 a1에서 등록된 a2 라벨 집합 (미등록 조합 비활성화용) */
  function validAxis2For(x1: string): Set<string> {
    return new Set(
      rows.filter((r) => (r.axis1Label ?? '') === x1 && r.axis2Label).map((r) => r.axis2Label as string),
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

  const selected = useMemo(() => findRow(a1, a2) ?? first, [a1, a2, rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const validA2 = useMemo(() => validAxis2For(a1), [a1, rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayPrice = selected.price * qty
  const checkoutUrl = buildCheckoutUrl(
    selected.checkoutUrl,
    userId,
    { ...utmData, affiliate_ref: affiliateRef },
    qty,
    discountCode,
  )

  return (
    <div className="group relative flex flex-col rounded-lg border border-rule bg-paper-raised p-8 shadow-[0_1px_2px_rgba(35,39,46,0.05)] hover:border-ink-faint hover:shadow-[0_6px_20px_rgba(35,39,46,0.08)] transition-all duration-300">
      <div className="relative z-10 flex flex-col flex-1">
        {/* 뱃지 */}
        {product.badgeText && (
          <div className="mb-4">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${PRODUCT_BADGE_COLORS_PAPER[product.badgeColor] ?? PRODUCT_BADGE_COLORS_PAPER.blue}`}>
              <Sparkles size={11} />
              {product.badgeText}
            </span>
          </div>
        )}

        {/* 제품명 */}
        <h3 className="text-2xl font-bold text-ink mb-2">{product.name}</h3>
        <p className="text-sm text-ink-soft leading-relaxed mb-6">{product.tagline}</p>

        {/* 옵션 드롭다운 */}
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs text-ink-soft mb-1.5">{product.axis1Name ?? '옵션'}</label>
            <select
              value={a1}
              onChange={(e) => changeA1(e.target.value)}
              className="w-full bg-paper-raised border border-rule text-ink text-sm rounded-md px-3 py-2.5 focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 cursor-pointer"
            >
              {axis1Options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {hasAxis2 && (
            <div>
              <label className="block text-xs text-ink-soft mb-1.5">{product.axis2Name ?? '옵션'}</label>
              <select
                value={a2}
                onChange={(e) => setA2(e.target.value)}
                className="w-full bg-paper-raised border border-rule text-ink text-sm rounded-md px-3 py-2.5 focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 cursor-pointer"
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
            <span className="text-4xl font-bold text-ink">{formatPrice(displayPrice)}</span>
            {selected.suffix && <span className="text-ink-soft text-base">{selected.suffix}</span>}
          </div>
          <p className="text-xs text-ink-faint mt-1.5">
            {qty > 1 ? `${formatPrice(selected.price)}${selected.suffix} × ${qty} · ` : ''}VAT 포함
          </p>
        </div>

        {/* 구매 버튼 */}
        <Link
          href={userId ? checkoutUrl : '/auth/register'}
          onClick={() => onCheckout?.(qty)}
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
                    {desc ? (<><strong className="text-ink">{title}:</strong> {desc}</>) : title}
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
