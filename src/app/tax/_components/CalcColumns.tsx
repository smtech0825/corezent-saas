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

/** 2단 배치가 켜지는 최소 폭(px) — 아래 xl: 클래스의 전환점과 반드시 함께 움직인다 */
const TWO_COLUMN_MIN_WIDTH = 1280

/** 결과 DOM이 붙기를 기다리는 최대 시간 — 한 프레임(16ms) × 20회 ≈ 0.3초 */
const SCROLL_RETRY_LIMIT = 20

/**
 * @함수명: scrollResultIntoView
 * @설명: 계산 직후 결과 자리로 스크롤합니다 — 단, 결과가 폼 아래에 쌓이는 좁은 화면에서만.
 *        2단이 켜진 넓은 화면에서는 결과가 폼 바로 옆에 나타나므로 화면을 움직이지
 *        않습니다(계산 버튼을 누르면 화면이 위로 튀는 것처럼 보이던 문제).
 *        결과 요소는 상태 반영(리렌더) 뒤에 붙으므로 ref를 받아 잠깐 기다립니다 —
 *        한 프레임만 기다리면 아직 없어 스크롤이 조용히 건너뛰어질 수 있습니다.
 * @매개변수: ref - 결과 영역 ref(내용이 채워지면 그 자리로 이동)
 * @반환값: 없음
 */
export function scrollResultIntoView(ref: { current: HTMLElement | null }): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia(`(min-width: ${TWO_COLUMN_MIN_WIDTH}px)`).matches) return
  let tries = 0
  const tick = () => {
    const el = ref.current
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (++tries < SCROLL_RETRY_LIMIT) window.setTimeout(tick, 16)
  }
  tick()
}

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
