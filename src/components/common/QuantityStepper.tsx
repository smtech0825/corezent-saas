'use client'

/**
 * @컴포넌트: QuantityStepper
 * @설명: 체크아웃 수량(같은 상품 N개) 선택 스테퍼 — 가격 카드의 구매 버튼 근처에 배치.
 *        선택한 수량은 LS 체크아웃 URL의 `quantity` 파라미터로 전달됩니다.
 *        (장바구니가 아님 — 같은 상품을 수량만 늘려 결제하는 용도)
 */

import { Minus, Plus } from 'lucide-react'
import { BUY_BAR_CONTROL_BOX } from './controlBox'

/** 체크아웃 수량 상한 (LS 자체 상한과 별개로 UI 오입력·남용 방지) */
export const MAX_CHECKOUT_QUANTITY = 10

interface Props {
  /** 현재 수량 (1 이상) */
  value: number
  /** 수량 변경 콜백 */
  onChange: (next: number) => void
  /** 최대 수량 (기본 MAX_CHECKOUT_QUANTITY) */
  max?: number
  /** true면 라벨을 컨트롤 위에 배치하고 하단 여백을 제거(구매 바 등 가로 정렬용) */
  inline?: boolean
}

export default function QuantityStepper({ value, onChange, max = MAX_CHECKOUT_QUANTITY, inline = false }: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(1, Math.floor(n)))

  // 구매 바(inline)에서는 공통 박스 규격(BUY_BAR_CONTROL_BOX, h-10=40px)을 써 옆 컨트롤과 높이를 통일.
  // 버튼·숫자는 h-full로 박스 높이를 채우되 바깥 높이는 좌우하지 않는다. 카드형(default)은 기존 규격 유지.
  const boxCls = inline
    ? `${BUY_BAR_CONTROL_BOX} overflow-hidden`
    : 'inline-flex items-center border border-rule rounded-md overflow-hidden bg-paper'
  const btnCls = `${inline ? 'h-full inline-flex items-center px-2' : 'px-2 py-1.5'} text-ink-soft hover:text-ink hover:bg-paper-shade disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer`
  const numCls = `${inline ? 'h-full inline-flex items-center justify-center' : 'text-center'} min-w-[1.75rem] text-sm font-semibold text-ink tabular-nums select-none`

  // +/- 스테퍼 본체(두 레이아웃 공통)
  const stepper = (
    <div className={boxCls}>
      <button
        type="button"
        aria-label="수량 줄이기"
        disabled={value <= 1}
        onClick={() => onChange(clamp(value - 1))}
        className={btnCls}
      >
        <Minus size={12} />
      </button>
      <span className={numCls}>
        {value}
      </span>
      <button
        type="button"
        aria-label="수량 늘리기"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={btnCls}
      >
        <Plus size={12} />
      </button>
    </div>
  )

  // inline: 라벨 상단 배치(세그먼트 컨트롤과 정렬) — 구매 바용
  if (inline) {
    return (
      <div className="min-w-0">
        <span className="block text-[11px] text-ink-faint mb-1 leading-none">수량</span>
        {stepper}
      </div>
    )
  }

  // 기본: 라벨 좌측 + 하단 여백(카드형 구매 박스용)
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <span className="text-xs text-ink-soft">수량</span>
      {stepper}
    </div>
  )
}
