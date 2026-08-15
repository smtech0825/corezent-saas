/**
 * @파일: tax/_components/CalcColumns.tsx
 * @설명: 폼|결과 좌우 2단 배치의 단일 출처 — 계산기 8종이 공유한다(2026-08-16 PC 폭
 *        확대 지시). lg(1024px)부터 왼쪽=입력 폼(최대 36rem — 기존 세로 배치와 같은
 *        밀도를 유지해 폼 내부 2열 입력이 좁아지지 않게 함), 오른쪽=결과.
 *        lg 미만(모바일·태블릿 세로)은 전부 lg: 접두사라 기존 세로 배치와 픽셀 단위로
 *        동일하다. 결과가 아직 없으면 오른쪽에 자리표시 카드를 두고(넓은 화면 전용 —
 *        모바일에서는 요소째 숨겨 여백 변화도 없음), 입력 변경으로 결과가 지워졌을 때도
 *        같은 자리표시로 복귀한다(기존 보류 '결과 소멸 시 빈 자리' 해소).
 *        배치를 바꿀 때 이 파일만 고치면 8종에 한 번에 적용된다.
 */

import type { ReactNode } from 'react'

/** 폼|결과 2단 그리드 — 첫 자식(폼)이 왼쪽 열, CalcResultSlot이 오른쪽 열 */
export default function CalcColumns({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:gap-8 lg:items-start">
      {children}
    </div>
  )
}

/** 결과 자리 — 내용이 없으면(계산 전·결과 소멸) 자리표시 카드. 모바일에서는 숨김 */
export function CalcResultSlot({ children }: { children?: ReactNode }) {
  if (!children) {
    return (
      <div
        aria-hidden="true"
        className="hidden lg:flex items-center justify-center min-h-64 bg-paper-raised/60 border border-dashed border-rule rounded-lg"
      >
        <p className="text-sm text-ink-faint">계산하면 결과가 여기에 표시됩니다</p>
      </div>
    )
  }
  return <div className="min-w-0">{children}</div>
}
