/**
 * @컴포넌트: CalcColumns
 * @설명: 폼|결과 좌우 2단 배치의 단일 출처 — 계산기 8종이 공유한다(2026-08-15 PC 폭
 *        확대 지시). xl(1280px)부터 왼쪽=입력 폼(최대 36rem — 기존 세로 배치와 같은
 *        밀도), 오른쪽=결과(≈620px+ — 기존 단일 열 528px보다 항상 넓음). 전환점을
 *        lg가 아닌 xl로 잡은 이유: lg(1024px)면 태블릿 가로가 2단에 걸리고 결과 열이
 *        353~481px로 기존보다 좁아진다(점검 지적). xl 미만은 전부 기존 세로 배치와
 *        픽셀 단위로 동일하다.
 *        간격은 space-y가 아니라 flex gap — display:none인 자리표시가 마진 체인
 *        (:not(:last-child))에 끼어 숨은 여백을 만드는 것을 막는다(Tailwind v4 특성).
 *        결과가 없으면 오른쪽에 자리표시 카드(xl 전용 — 모바일에서는 요소째 숨김),
 *        입력 변경으로 결과가 지워졌을 때도 같은 자리표시로 복귀한다(기존 보류
 *        '결과 소멸 시 빈 자리' 해소). 배치 변경은 이 파일만 고치면 8종에 적용된다.
 */

import type { ReactNode } from 'react'

/** 폼|결과 2단 그리드 — 첫 자식(폼)이 왼쪽 열, CalcResultSlot이 오른쪽 열 */
export default function CalcColumns({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] xl:gap-8 xl:items-start">
      {children}
    </div>
  )
}

/** 결과 자리 — 내용이 없으면(계산 전·결과 소멸) 자리표시 카드. xl 미만에서는 숨김 */
export function CalcResultSlot({ children }: { children?: ReactNode }) {
  if (!children) {
    return (
      <div
        aria-hidden="true"
        className="hidden xl:flex items-center justify-center min-h-64 bg-paper-raised/60 border border-dashed border-rule rounded-lg"
      >
        <p className="text-sm text-ink-faint">계산하면 결과가 여기에 표시됩니다</p>
      </div>
    )
  }
  return <div className="min-w-0">{children}</div>
}
