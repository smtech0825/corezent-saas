import type { ReactNode } from 'react'

/**
 * @컴포넌트: Container (공통 프리미티브)
 * @설명: 표준 가로 폭 컨테이너 — 사이트 전체 max-width를 3종으로 통일.
 *        text(본문 서식) / content(기본) / wide(그리드 섹션)
 */

type ContainerWidth = 'text' | 'content' | 'wide'

interface ContainerProps {
  width?: ContainerWidth
  className?: string
  children: ReactNode
}

const WIDTH_CLS: Record<ContainerWidth, string> = {
  text:    'max-w-3xl',
  content: 'max-w-5xl',
  wide:    'max-w-7xl',
}

export default function Container({ width = 'content', className = '', children }: ContainerProps) {
  return (
    <div className={`${WIDTH_CLS[width]} mx-auto px-4 sm:px-6 ${className}`}>
      {children}
    </div>
  )
}
