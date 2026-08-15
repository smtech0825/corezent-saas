/**
 * @컴포넌트: CalcSection
 * @설명: 계산 섹션 폭의 단일 출처 — 허브 + 계산기 8종이 공유한다(2026-08-15 PC 폭 확대
 *        지시). 폭·배치를 바꿀 때 이 파일만 고치면 전 계산기에 한 번에 적용된다.
 *        default: xl(1280px)부터 max-w-7xl(1280px)로 넓어진다 — 좌열 576px 고정인
 *        2단(CalcColumns)에서 결과 열이 기존 단일 열(528px)보다 항상 넓도록(≈620px+)
 *        전환점을 xl로 잡았다. lg(1024~1279px — 태블릿 가로 포함)는 기존 세로
 *        배치·576px 그대로라 모바일·태블릿이 픽셀 단위로 무변경이다.
 *        narrow: 항상 기존 폭(576px) — 2단 배치가 없는 허브(목록)용.
 */

import type { ReactNode } from 'react'

/** 섹션 폭 옵션 — 폭 전환은 이 맵만 고친다 (xl 미만은 항상 기존 폭 유지) */
const WIDTH_CLASS: Record<'default' | 'narrow', string> = {
  default: 'max-w-xl xl:max-w-7xl',
  narrow: 'max-w-xl',
}

/** 계산 섹션 래퍼 — 기준일 배너·폼·결과·판단 한계를 담는 컨테이너 */
export default function CalcSection({ children, width = 'default', className }: {
  children: ReactNode
  /** 'narrow'는 2단 배치가 없는 목록형 페이지(허브)용 — 항상 기존 폭 유지 */
  width?: 'default' | 'narrow'
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
 * 판단 한계·하단 고지 래퍼 — 섹션이 넓어지는 xl 이상에서 안내 본문의 글줄을 읽기 좋은
 * 길이(max-w-2xl·672px, 중앙)로 제한한다. xl 미만에서는 부모(576px)가 더 좁아 무효과.
 */
export function CalcNotes({ children }: { children: ReactNode }) {
  return <div className="max-w-2xl mx-auto">{children}</div>
}
