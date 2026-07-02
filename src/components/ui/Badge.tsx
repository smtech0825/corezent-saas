import type { ReactNode } from 'react'

/**
 * @컴포넌트: Badge (공통 프리미티브)
 * @설명: 페이퍼 테마 상태·카테고리 뱃지.
 *        variant: pen(파랑) / seal(빨강 — 강조·모집중) / ink(중립) / shade(옅은 배경)
 */

type BadgeVariant = 'pen' | 'seal' | 'ink' | 'shade'

interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: ReactNode
}

const VARIANT_CLS: Record<BadgeVariant, string> = {
  pen:   'border-pen/40 text-pen bg-pen/5',
  seal:  'border-seal/50 text-seal bg-seal/5',
  ink:   'border-ink/30 text-ink-soft bg-transparent',
  shade: 'border-rule text-ink-soft bg-paper-shade',
}

export default function Badge({ variant = 'ink', className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-0.5 font-sans text-xs font-semibold ${VARIANT_CLS[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
