/**
 * @파일: tax/_components/CalcSection.tsx
 * @설명: 계산 섹션 폭의 단일 출처 — 허브 + 계산기 8종이 공유한다(2026-08-16 PC 폭 확대
 *        지시). 폭·배치를 바꿀 때 이 파일만 고치면 전 계산기에 한 번에 적용된다.
 *        폭: lg(1024px)부터만 넓어진다 — default=1152px(PC에서 폼|결과 2단),
 *        wide=1280px(연도별 비교 등 더 넓은 화면용 옵션). lg 미만은 기존 그대로
 *        max-w-xl(576px)이라 모바일·태블릿이 픽셀 단위로 무변경이다.
 *        좌우 2단 배치는 CalcColumns가 담당한다.
 */

import type { ReactNode } from 'react'

/** 섹션 폭 옵션 — 폭 전환은 이 맵만 고친다 (lg 미만은 항상 기존 폭 유지) */
const WIDTH_CLASS: Record<'default' | 'wide', string> = {
  default: 'max-w-xl lg:max-w-6xl',
  wide: 'max-w-xl lg:max-w-7xl',
}

/** 계산 섹션 래퍼 — 기준일 배너·폼·결과·판단 한계를 담는 컨테이너 */
export default function CalcSection({ children, width = 'default', className }: {
  children: ReactNode
  /** 'wide'는 연도별 비교처럼 더 넓은 화면이 필요한 페이지용(다음 단계에서 폭 분리) */
  width?: 'default' | 'wide'
  /** 추가 클래스(허브의 space-y-8 등) — 폭·여백 기본값은 래퍼가 소유한다 */
  className?: string
}) {
  return (
    <section className={`${WIDTH_CLASS[width]} mx-auto px-4 sm:px-6 py-10${className ? ` ${className}` : ''}`}>
      {children}
    </section>
  )
}

/**
 * 판단 한계·하단 고지 래퍼 — 섹션이 넓어져도 안내 본문의 글줄을 읽기 좋은 길이
 * (max-w-2xl·672px)로 제한한다(중앙). 지금 폭(max-w-xl 섹션)에서는 부모가 더 좁아
 * 효과가 없다 — 다음 단계에서 섹션이 넓어질 때 자동으로 의미를 갖는다.
 */
export function CalcNotes({ children }: { children: ReactNode }) {
  return <div className="max-w-2xl mx-auto">{children}</div>
}
