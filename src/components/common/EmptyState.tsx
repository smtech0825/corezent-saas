/**
 * @컴포넌트: EmptyState
 * @설명: "~가 없습니다" 빈 상태 안내 공용 부품.
 *        같은 안내가 화면마다 여백·구조가 제각각이라(py-16 / py-12 / py-8 / px-5 py-6)
 *        여백과 모양을 여기 한 곳에서 제어한다. 여백은 조사 시점 다수값(py-16)을 채택.
 *        빈 공간을 채우기 위한 새 문구·수치는 여기서 만들지 않는다 — 넘겨받은 것만 그린다.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

interface Props {
  /** 안내 문장 */
  message: ReactNode
  /** 상단 원형 배지에 들어갈 아이콘 (선택) */
  icon?: ReactNode
  /** 안내 아래 보조 설명 (선택) */
  description?: string
  /** 이동 링크 (선택) — "라벨 →" 형태로 그린다 */
  cta?: { label: string; href: string }
  /** true면 자체 카드(테두리·배경)로 감싼다. 표·카드 안에 놓을 때는 생략 */
  boxed?: boolean
  /** true면 부모가 늘려 준 높이를 채우며 세로 가운데 정렬 (옆 카드와 높이가 묶이는 그리드용) */
  fill?: boolean
}

export default function EmptyState({ message, icon, description, cta, boxed, fill }: Props) {
  const inner = (
    <div className={`text-center ${fill ? 'flex-1 flex flex-col items-center justify-center py-8' : 'py-16'}`}>
      {icon && (
        <div className="w-12 h-12 rounded-full bg-paper-shade flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
      )}
      <p className="text-sm text-ink-soft">{message}</p>
      {description && <p className="text-sm text-ink-faint mt-1">{description}</p>}
      {cta && (
        <Link href={cta.href} className="inline-flex items-center gap-1 text-sm text-mark hover:underline mt-3">
          {cta.label} →
        </Link>
      )}
    </div>
  )

  if (!boxed) return inner
  return (
    <div className={`bg-paper-raised border border-rule rounded-card ${fill ? 'flex flex-col h-full' : ''}`}>
      {inner}
    </div>
  )
}
