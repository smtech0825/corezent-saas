/**
 * @컴포넌트: SelectField
 * @설명: 값을 고르는 입력칸(드롭다운) 공용 부품. 브라우저 기본 화살표를 없애고
 *        (appearance-none) 사이트 모양의 화살표를 직접 그린다.
 *        <select> 요소 자체는 네이티브 그대로 유지한다 — 키보드로 열기(Space/Enter),
 *        화살표 키 이동, 글자 입력 점프, 화면낭독기의 콤보박스 낭독이 전부 브라우저
 *        기본 동작으로 남는다. 장식 화살표는 pointer-events-none이라 클릭도 막지 않는다.
 *        고르는 항목·동작은 여기서 만들지 않는다 — 넘겨받은 것만 그린다.
 */

import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'

/** 크기 3종 — 사용처의 맥락(표 셀 / 나란한 입력칸)과 높이를 맞춘다 */
const SIZE_CLS = {
  xs: 'text-xs pl-2 pr-6 py-1.5 rounded-md',
  sm: 'text-sm pl-3 pr-8 py-2.5 rounded-lg',
  md: 'text-sm pl-4 pr-9 py-2.5 rounded-xl',
} as const

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** 크기 — xs(표 셀)·sm(작은 폼·필터)·md(폼, 기본) */
  size?: keyof typeof SIZE_CLS
  /** 폭을 담당하는 래퍼 클래스 (기본 w-full) */
  wrapperClassName?: string
}

export default function SelectField({
  size = 'md', wrapperClassName, className, children, ...props
}: Props) {
  return (
    <span className={`relative inline-block align-middle ${wrapperClassName ?? 'w-full'}`}>
      <select
        {...props}
        className={`appearance-none w-full bg-paper border border-rule text-ink cursor-pointer focus:outline-none focus:border-mark disabled:opacity-60 disabled:cursor-not-allowed ${SIZE_CLS[size]} ${className ?? ''}`}
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint"
      />
    </span>
  )
}
