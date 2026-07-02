import type { ReactNode } from 'react'

/**
 * @컴포넌트: Card (공통 프리미티브)
 * @설명: 페이퍼 테마 표준 카드 — 흰 종이 위 괘선 테두리.
 *        variant: solid(기본) / dashed(점선 — 출시 예정·추가 액션용)
 */

interface CardProps {
  variant?: 'solid' | 'dashed'
  hover?: boolean
  className?: string
  children: ReactNode
}

export default function Card({ variant = 'solid', hover = false, className = '', children }: CardProps) {
  return (
    <div
      className={[
        'rounded-lg bg-paper-raised p-6',
        variant === 'dashed' ? 'border-[1.5px] border-dashed border-rule' : 'border border-rule shadow-[0_1px_2px_rgba(35,39,46,0.05)]',
        hover ? 'transition-all duration-200 hover:border-ink-faint hover:shadow-[0_6px_20px_rgba(35,39,46,0.08)]' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}
