'use client'

/**
 * @컴포넌트: ProductBuyBar
 * @설명: 상품 상세 페이지 하단 고정(플로팅) 구매 바.
 *        요소 순서(좌→우): 옵션1(기간) → 옵션2(PC수 등, 있을 때만) → 수량 → 가격 → 구매 버튼.
 *        옵션 상품과 비옵션 상품을 공통 OptionRow[] 모델로 처리한다(축 옵션이 하나뿐이면 해당 세그먼트 미렌더).
 *        결제 링크는 buildCheckoutUrl을 그대로 재사용(미접촉). 바의 실제 높이를 측정해 `--buy-bar-h`
 *        CSS 변수로 노출 → 페이지가 그만큼 하단 패딩을 잡아 푸터·본문이 바에 가리지 않게 한다.
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { formatPrice } from '@/lib/price'
import { buildCheckoutUrl } from '@/lib/lemonsqueezy'
import { createClient } from '@/lib/supabase/client'
import { getUtmData, type UtmData } from '@/lib/cookies'
import QuantityStepper from '@/components/common/QuantityStepper'
import SegmentControl from '@/components/common/SegmentControl'
import type { OptionRow } from '@/lib/product-options'

interface Props {
  productName: string
  isActive: boolean
  affiliateRef: string
  axis1Name: string | null
  axis2Name: string | null
  optionRows: OptionRow[]
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

/**
 * @함수명: ProductBuyBar
 * @설명: 선택한 옵션 조합의 단가×수량을 즉시 갱신하고 그 행의 checkout_url로 구매 버튼을 연결합니다.
 */
export default function ProductBuyBar({
  productName, isActive, affiliateRef, axis1Name, axis2Name, optionRows,
}: Props) {
  const rows = optionRows

  // 로그인/UTM/할인코드는 클라이언트에서 스스로 확보(체크아웃 URL 주입 규칙 공통)
  const [userId, setUserId] = useState<string | null>(null)
  const [utmData, setUtmData] = useState<UtmData | null>(null)
  const [discountCode, setDiscountCode] = useState('')
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
    setUtmData(getUtmData())
    const c = new URLSearchParams(window.location.search).get('discount')
    if (c) setDiscountCode(c.trim().slice(0, 64))
  }, [])

  // 바의 실제 높이를 CSS 변수로 노출 → 페이지 하단 패딩과 동기화
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const root = document.documentElement
    const apply = () => root.style.setProperty('--buy-bar-h', `${el.offsetHeight}px`)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--buy-bar-h')
    }
  }, [])

  const axis1Options = useMemo(() => uniqueInOrder(rows.map((r) => r.axis1Label)), [rows])
  const axis2Options = useMemo(() => uniqueInOrder(rows.map((r) => r.axis2Label)), [rows])
  const hasAxis2 = axis2Options.length > 0
  const showAxis1 = axis1Options.length >= 2

  const first = rows[0]
  const [a1, setA1] = useState<string>(first?.axis1Label ?? '')
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
    <div
      ref={barRef}
      className="fixed bottom-0 inset-x-0 z-[60] border-t border-rule bg-paper shadow-[0_-4px_24px_rgba(35,39,46,0.10)]"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
          {/* 옵션1 · 옵션2 · 수량 */}
          <div className="flex items-center flex-wrap gap-3 md:gap-4 min-w-0">
            {showAxis1 && (
              <SegmentControl
                label={axis1Name ?? '옵션'}
                value={a1}
                onChange={changeA1}
                options={axis1Options.map((o) => ({ value: o, label: o }))}
              />
            )}
            {hasAxis2 && (
              <SegmentControl
                label={axis2Name ?? '옵션'}
                value={a2}
                onChange={setA2}
                options={axis2Options.map((o) => ({
                  value: o,
                  label: validA2.has(o) ? o : `${o} (미출시)`,
                  disabled: !validA2.has(o),
                }))}
              />
            )}
            <QuantityStepper inline value={qty} onChange={setQty} />
          </div>

          {/* 가격 + 구매하기 */}
          <div className="flex items-center justify-between md:justify-end gap-4 md:ml-auto">
            <div className="leading-none">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-ink tabular-nums">{formatPrice(displayPrice)}</span>
                {selected.suffix && <span className="text-sm text-ink-soft">{selected.suffix}</span>}
              </div>
              <p className="text-[11px] text-ink-faint mt-1">
                {qty > 1 ? `${formatPrice(selected.price)}${selected.suffix} × ${qty} · ` : ''}VAT 포함
              </p>
            </div>

            {isActive ? (
              <Link
                href={userId ? checkoutUrl : '/auth/register'}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-sm font-semibold bg-pen text-white hover:bg-pen-dark hover:shadow-[0_8px_24px_rgba(29,63,176,0.25)] transition-all duration-200 whitespace-nowrap shrink-0 max-md:flex-1"
                aria-label={`${productName} 구매`}
              >
                구매하기
                <ArrowRight size={14} />
              </Link>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-sm font-medium border border-dashed border-rule text-ink-faint whitespace-nowrap shrink-0 max-md:flex-1">
                출시 예정
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
