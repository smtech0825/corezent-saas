import type { ReactNode } from 'react'
import Container from '@/components/ui/Container'

/**
 * @컴포넌트: Section / SectionHeader (공통 프리미티브)
 * @설명: 페이퍼 테마 표준 섹션 리듬(py)과 공문서식 섹션 머리.
 *        SectionHeader — 네모 칸 라벨(공문 필드 라벨) + 명조 제목 + 부제
 */

type SectionTone = 'paper' | 'shade'

interface SectionProps {
  id?: string
  tone?: SectionTone
  width?: 'text' | 'content' | 'wide'
  className?: string
  children: ReactNode
}

export default function Section({ id, tone = 'paper', width = 'content', className = '', children }: SectionProps) {
  return (
    <section
      id={id}
      className={`py-16 sm:py-24 ${tone === 'shade' ? 'bg-paper-shade/60 border-y border-rule' : ''} ${className}`}
    >
      <Container width={width}>{children}</Container>
    </section>
  )
}

// ─── 섹션 머리 ────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  /** 네모 칸 안에 들어가는 짧은 라벨 (공문 필드 라벨 스타일) */
  label?: string
  title: string
  sub?: string
  align?: 'left' | 'center'
}

export function SectionHeader({ label, title, sub, align = 'left' }: SectionHeaderProps) {
  const alignCls = align === 'center' ? 'text-center items-center' : 'text-left items-start'
  return (
    <div className={`flex flex-col ${alignCls} mb-12 sm:mb-16`}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <h2 className="font-serif font-black text-3xl sm:text-4xl text-ink leading-snug tracking-tight break-keep">
        {title}
      </h2>
      {sub && (
        <p className={`mt-4 text-base sm:text-lg text-ink-soft break-keep max-w-xl ${align === 'center' ? 'mx-auto' : ''}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

/** 공문서식 네모 칸 라벨 — "제목"·"수신" 같은 필드 라벨 모양 */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block border-[1.5px] border-ink px-3 py-1 mb-5 font-sans text-xs font-bold tracking-[0.3em] [text-indent:0.3em] text-ink">
      {children}
    </span>
  )
}
