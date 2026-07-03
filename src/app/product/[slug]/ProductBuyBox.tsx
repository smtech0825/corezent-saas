'use client'

/**
 * @컴포넌트: ProductBuyBox
 * @설명: 제품 상세 우측 sticky 구매 박스 — 옵션이 없는 상품용(가격 + 월/연 주기 토글 + 구매 CTA).
 *        옵션 있는 상품은 ProductOptionSelector가 대신 들어간다. 결제 로직 미접촉(CTA는 기존 /pricing 흐름).
 */

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { formatPrice } from '@/lib/price'

interface Props {
  productName: string
  monthly: number | null      // 월간 구독가(원/월)
  annual: number | null       // 연간 구독가(원/년, 연 총액)
  oneTime: number | null      // 일회 구매가(원)
  isActive: boolean
  ctaHref: string             // 구매 CTA 링크(기존 흐름 유지 — 라우팅 변경 없음)
}

/**
 * @함수명: ProductBuyBox
 * @설명: 상품의 가격 유형(월간·연간·일회)에 따라 가격 표시와 주기 토글을 렌더한다.
 */
export default function ProductBuyBox({ productName, monthly, annual, oneTime, isActive, ctaHref }: Props) {
  const hasBoth = monthly != null && annual != null
  const [annualView, setAnnualView] = useState(false)

  // 연간 절약률 — 월간 대비 (연 총액/12) 기준
  const savePct = monthly && annual ? Math.round((1 - annual / 12 / monthly) * 100) : 0

  return (
    <div className="border border-rule bg-paper-raised rounded-lg p-6 w-full">
      {/* 월/연 토글 — 둘 다 있을 때만 */}
      {hasBoth && (
        <div className="inline-flex items-center border border-rule bg-paper rounded-full p-1 gap-0.5 mb-5">
          <button
            type="button"
            onClick={() => setAnnualView(false)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${!annualView ? 'bg-pen text-white' : 'text-ink-soft hover:text-ink'}`}
          >
            월간
          </button>
          <button
            type="button"
            onClick={() => setAnnualView(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${annualView ? 'bg-pen text-white' : 'text-ink-soft hover:text-ink'}`}
          >
            연간
            {savePct > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${annualView ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                {savePct}% 절약
              </span>
            )}
          </button>
        </div>
      )}

      {/* 가격 */}
      <div className="mb-6">
        {oneTime != null && monthly == null && annual == null ? (
          <>
            <span className="text-4xl font-bold text-ink">{formatPrice(oneTime)}</span>
            <p className="text-xs text-ink-faint mt-1.5">1회 구매 · VAT 포함</p>
          </>
        ) : annualView && annual != null ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-ink">{formatPrice(annual)}</span>
              <span className="text-ink-soft text-base">/년</span>
            </div>
            <p className="text-xs text-emerald-700 mt-1.5 font-medium">
              월 약 {formatPrice(Math.round(annual / 12))}
              {savePct > 0 ? ` · ${savePct}% 절약` : ''} · VAT 포함
            </p>
          </>
        ) : monthly != null ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-ink">{formatPrice(monthly)}</span>
              <span className="text-ink-soft text-base">/월</span>
            </div>
            <p className="text-xs text-ink-faint mt-1.5">
              {annual != null ? `또는 연 ${formatPrice(annual)}${savePct > 0 ? ` (${savePct}% 절약)` : ''} · ` : ''}VAT 포함
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-faint">가격 준비 중</p>
        )}
      </div>

      {/* 구매 CTA — 비활성(출시 예정) 상품은 안내만 */}
      {isActive ? (
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-md text-sm font-semibold bg-pen text-white hover:bg-pen-dark hover:shadow-[0_8px_24px_rgba(29,63,176,0.25)] hover:-translate-y-0.5 transition-all duration-200"
          aria-label={`${productName} 구매`}
        >
          구매하기
          <ArrowRight size={14} />
        </Link>
      ) : (
        <span className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-md text-sm font-medium border border-dashed border-rule text-ink-faint">
          출시 예정
        </span>
      )}
    </div>
  )
}
