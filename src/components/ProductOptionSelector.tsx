'use client'

/**
 * @컴포넌트: ProductOptionSelector
 * @설명: 옵션 있는 상품의 "구매 박스" — 축1·축2 드롭다운 + 수량 → 선택 조합의 가격×수량 즉시 갱신,
 *        그 행의 checkout_url로 구매 버튼 연결. /buy/[slug]·/product/[slug]가 공유하는 표시 계층.
 *        userId·UTM·할인코드는 클라이언트에서 스스로 조회하고, affiliateRef만 서버에서 받는다.
 */

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { formatPrice } from '@/lib/price'
import { buildCheckoutUrl } from '@/lib/lemonsqueezy'
import { createClient } from '@/lib/supabase/client'
import { getUtmData, type UtmData } from '@/lib/cookies'
import QuantityStepper from '@/components/common/QuantityStepper'
import type { OptionRow } from '@/lib/product-options'

interface Props {
  productName: string
  axis1Name: string | null
  axis2Name: string | null
  optionRows: OptionRow[]
  affiliateRef: string
  /** 초기 축1 라벨(예: 요금제 토글에서 '연간'으로 진입) — 유효하지 않으면 첫 옵션 */
  initialAxis1?: string | null
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

export default function ProductOptionSelector({
  productName, axis1Name, axis2Name, optionRows, affiliateRef, initialAxis1,
}: Props) {
  const rows = optionRows

  // 로그인/UTM/할인코드는 클라이언트에서 스스로 확보 (페이지 어디에 놓여도 동작하도록)
  const [userId, setUserId] = useState<string | null>(null)
  const [utmData, setUtmData] = useState<UtmData | null>(null)
  const [discountCode, setDiscountCode] = useState('')
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
    setUtmData(getUtmData())
    const c = new URLSearchParams(window.location.search).get('discount')
    if (c) setDiscountCode(c.trim().slice(0, 64))
  }, [])

  const axis1Options = useMemo(() => uniqueInOrder(rows.map((r) => r.axis1Label)), [rows])
  const axis2Options = useMemo(() => uniqueInOrder(rows.map((r) => r.axis2Label)), [rows])
  const hasAxis2 = axis2Options.length > 0

  const first = rows[0]
  const [a1, setA1] = useState<string>(
    initialAxis1 && axis1Options.includes(initialAxis1) ? initialAxis1 : (first?.axis1Label ?? ''),
  )
  const [a2, setA2] = useState<string>(first?.axis2Label ?? '')
  const [qty, setQty] = useState(1)

  function findRow(x1: string, x2: string) {
    return rows.find(
      (r) => (r.axis1Label ?? '') === x1 && (hasAxis2 ? (r.axis2Label ?? '') === x2 : true),
    )
  }
  function validAxis2For(x1: string): Set<string> {
    return new Set(
      rows.filter((r) => (r.axis1Label ?? '') === x1 && r.axis2Label).map((r) => r.axis2Label as string),
    )
  }
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

  if (rows.length === 0 || !selected) return null

  const displayPrice = selected.price * qty
  const checkoutUrl = buildCheckoutUrl(
    selected.checkoutUrl,
    userId,
    { ...utmData, affiliate_ref: affiliateRef },
    qty,
    discountCode,
  )

  return (
    <div className="border border-rule bg-paper-raised rounded-lg p-6 w-full max-w-sm">
      {/* 옵션 드롭다운 */}
      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-xs text-ink-soft mb-1.5">{axis1Name ?? '옵션'}</label>
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
            <label className="block text-xs text-ink-soft mb-1.5">{axis2Name ?? '옵션'}</label>
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

      {/* 구매 버튼 (비로그인은 회원가입으로) */}
      <Link
        href={userId ? checkoutUrl : '/auth/register'}
        className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-md text-sm font-semibold bg-pen text-white hover:bg-pen-dark hover:shadow-[0_8px_24px_rgba(29,63,176,0.25)] hover:-translate-y-0.5 transition-all duration-200"
        aria-label={`${productName} 구매`}
      >
        구매하기
        <ArrowRight size={14} />
      </Link>
    </div>
  )
}
