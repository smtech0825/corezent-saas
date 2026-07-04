'use client'

/**
 * @컴포넌트: SegmentControl
 * @설명: 옵션 축(기간·PC수 등) 선택용 세그먼트 컨트롤 — 네이티브 select 대신 디자인 시스템에 맞춘 pill 그룹.
 *        소수 옵션 선택(구매 바 등)에 사용한다. 페이퍼 테마 톤. 비활성(미출시) 옵션은 disabled로 흐리게.
 */

import type { ReactNode } from 'react'
import { BUY_BAR_CONTROL_BOX } from './controlBox'

/** 세그먼트 옵션 하나 */
export interface SegmentOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface Props {
  /** 컨트롤 상단 라벨(예: 기간). 없으면 라벨을 렌더하지 않음 */
  label?: string
  /** 현재 선택 값 */
  value: string
  /** 선택 가능한 옵션 목록 */
  options: SegmentOption[]
  /** 선택 변경 콜백 */
  onChange: (value: string) => void
  /** 접근성용 그룹 라벨(보이는 label이 없을 때) */
  ariaLabel?: string
}

/**
 * @함수명: SegmentControl
 * @설명: 옵션 목록을 pill 버튼 그룹으로 렌더하고, 클릭 시 값을 변경합니다.
 * @매개변수: label - 상단 라벨, value - 현재 값, options - 옵션 목록, onChange - 변경 콜백
 * @반환값: 세그먼트 컨트롤 노드
 */
export default function SegmentControl({ label, value, options, onChange, ariaLabel }: Props) {
  return (
    <div className="min-w-0">
      {label && <span className="block text-[11px] text-ink-faint mb-1 leading-none">{label}</span>}
      <div
        role="radiogroup"
        aria-label={ariaLabel ?? label}
        className={`${BUY_BAR_CONTROL_BOX} p-0.5 gap-0.5`}
      >
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && onChange(opt.value)}
              // h-full: 바깥 박스(h-10) 안에서 높이를 채우되 바깥 높이는 좌우하지 않음(40px 고정 유지)
              className={`whitespace-nowrap h-full inline-flex items-center px-3 rounded text-xs font-medium transition-colors ${
                active
                  ? 'bg-pen text-white'
                  : opt.disabled
                    ? 'text-ink-faint/50 cursor-not-allowed'
                    : 'text-ink-soft hover:text-ink cursor-pointer'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
