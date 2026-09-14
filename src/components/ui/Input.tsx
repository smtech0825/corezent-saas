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
  /**
   * 이름표가 가리킬 입력칸의 id — **필수**.
   * 예전에는 선택이라 빠뜨려도 조용히 넘어갔고, 그러면 화면상 이름표는 보이지만
   * 화면낭독기에는 칸 이름이 읽히지 않는다. 타입에서 막아 빠뜨리면 빌드가 잡게 한다.
   * (자식 입력칸에 같은 id를 직접 적는다 — 자식이 여럿이거나 감싼 상자여도 안 깨진다)
   */
  htmlFor: string
  required?: boolean
  error?: string | null
  hint?: string
  /**
   * 이름표 클래스 덮어쓰기 — 화면마다 이름표 크기·색이 달라서 필요하다.
   * 넘기지 않으면 기본 스타일 그대로라 기존 호출부는 모양이 바뀌지 않는다.
   */
  labelClassName?: string
  /** 바깥 상자 클래스 덮어쓰기 — 기본은 세로 배치 + 6px 간격 */
  className?: string
  children: ReactNode
}

const FIELD_LABEL_CLS = 'font-sans text-sm font-semibold text-ink'

export function Field({
  label, htmlFor, required, error, hint, labelClassName, className, children,
}: FieldProps) {
  return (
    <div className={className ?? 'flex flex-col gap-1.5'}>
      <label htmlFor={htmlFor} className={labelClassName ?? FIELD_LABEL_CLS}>
        {label}
        {required && <span className="ml-1 text-seal">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-faint">{hint}</p>}
      {error && <p className="text-xs font-medium text-seal">{error}</p>}
    </div>
  )
}
