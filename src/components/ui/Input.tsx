import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

/**
 * @컴포넌트: Input / Textarea / Field (공통 프리미티브)
 * @설명: 페이퍼 테마 표준 입력 필드 — 흰 배경 + 괘선, 포커스 시 볼펜 파랑.
 *        Field — 라벨 + 입력 + 에러 메시지(인주 빨강) 래퍼
 */

const BASE_CLS =
  'w-full rounded-md border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-pen focus:ring-2 focus:ring-pen/15 focus:outline-none disabled:opacity-50'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return <input className={`${BASE_CLS} ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return <textarea className={`${BASE_CLS} min-h-28 ${className}`} {...rest} />
}

// ─── 라벨 + 에러 래퍼 ─────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string | null
  hint?: string
  children: ReactNode
}

export function Field({ label, htmlFor, required, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-sans text-sm font-semibold text-ink">
        {label}
        {required && <span className="ml-1 text-seal">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-faint">{hint}</p>}
      {error && <p className="text-xs font-medium text-seal">{error}</p>}
    </div>
  )
}
