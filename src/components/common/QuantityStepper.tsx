'use client'

/**
 * @컴포넌트: QuantityStepper
 * @설명: 체크아웃 수량(같은 상품 N개) 선택 스테퍼 — 가격 카드의 구매 버튼 근처에 배치.
 *        선택한 수량은 LS 체크아웃 URL의 `quantity` 파라미터로 전달됩니다.
 *        (장바구니가 아님 — 같은 상품을 수량만 늘려 결제하는 용도)
 */

import { Minus, Plus } from 'lucide-react'

/** 체크아웃 수량 상한 (LS 자체 상한과 별개로 UI 오입력·남용 방지) */
export const MAX_CHECKOUT_QUANTITY = 10

interface Props {
  /** 현재 수량 (1 이상) */
  value: number
  /** 수량 변경 콜백 */
  onChange: (next: number) => void
  /** 최대 수량 (기본 MAX_CHECKOUT_QUANTITY) */
  max?: number
}

export default function QuantityStepper({ value, onChange, max = MAX_CHECKOUT_QUANTITY }: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(1, Math.floor(n)))

  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <span className="text-xs text-[#94A3B8]">수량</span>
      <div className="inline-flex items-center border border-[#1E293B] rounded-lg overflow-hidden">
        <button
          type="button"
          aria-label="수량 줄이기"
          disabled={value <= 1}
          onClick={() => onChange(clamp(value - 1))}
          className="px-2.5 py-1.5 text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Minus size={12} />
        </button>
        <span className="min-w-[2rem] text-center text-sm font-semibold text-white tabular-nums select-none">
          {value}
        </span>
        <button
          type="button"
          aria-label="수량 늘리기"
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
          className="px-2.5 py-1.5 text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}
