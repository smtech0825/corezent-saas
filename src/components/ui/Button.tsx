import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * @컴포넌트: Button (공통 프리미티브)
 * @설명: 페이퍼 테마 표준 버튼. href가 있으면 Link로, 없으면 button으로 렌더링.
 *        variant: primary(볼펜 파랑) / outline(볼펜 테두리) / ghost(텍스트) / danger(인주 빨강)
 */

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  href?: string
  external?: boolean
  className?: string
  children: ReactNode
}

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary: 'bg-pen text-white hover:bg-pen-dark hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(29,63,176,0.25)]',
  outline: 'border-[1.5px] border-pen text-pen hover:bg-pen/5 hover:-translate-y-0.5',
  ghost:   'text-ink-soft hover:text-ink underline-offset-4 hover:underline',
  danger:  'bg-seal text-white hover:brightness-95 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(201,58,44,0.25)]',
}

const SIZE_CLS: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-3.5 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  href,
  external,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    'inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-md cursor-pointer transition-all duration-200',
    VARIANT_CLS[variant],
    SIZE_CLS[size],
    className,
  ].join(' ')

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {children}
        </a>
      )
    }
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  )
}
