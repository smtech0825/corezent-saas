/**
 * @컴포넌트: StatCard
 * @설명: 숫자 하나를 크게 보여주는 통계 카드 공용 부품.
 *        같은 관리자·대시보드 안에서 통계 표시가 세 가지(라벨 위·아이콘 오른쪽 /
 *        아이콘 위·숫자·라벨 / 숫자·라벨 한 줄)로 갈라져 있던 것을,
 *        다수가 쓰던 "아이콘 위 → 숫자 → 라벨" 형태 하나로 모은다.
 *
 *        ★ 보조 수치(subMetrics)가 없으면 그 영역이 통째로 접혀 카드가 작아진다.
 *        빈 공간을 채우려고 새 수치·새 문구를 만들지 않는다 — 넘겨받은 것만 그린다.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

/** 구분선 아래 보조 수치 한 행 — growth가 null이면 증감률 대신 – 를 보여준다 */
export interface SubMetricRow {
  label: string
  value: string
  growth: number | null
}

interface Props {
  /** 지표 이름 (숫자 아래 줄) */
  label: string
  /** 크게 보여줄 값 */
  value: string
  /** 아이콘 (배지 안에 들어간다) */
  icon: ReactNode
  /** 아이콘 배지를 링크로 만들 때 (예: 열린 티켓 → 고객지원) */
  iconHref?: string
  /** 아이콘 링크의 설명 (iconHref와 함께 사용) */
  iconTitle?: string
  /** 아이콘 배지 색을 바꿀 때 (기본 bg-mark/10) */
  iconBadgeClassName?: string
  /** 라벨 아래 흐린 보조 한 줄 (선택 — 없으면 접힌다) */
  subline?: string
  /** 구분선 아래 보조 수치 행들 (선택 — 없으면 구분선째 접힌다) */
  subMetrics?: SubMetricRow[]
  /** 카드 전체를 링크로 만들 때 */
  href?: string
}

export default function StatCard({
  label, value, icon, iconHref, iconTitle, iconBadgeClassName, subline, subMetrics, href,
}: Props) {
  const badgeCls = `w-9 h-9 rounded-lg ${iconBadgeClassName ?? 'bg-mark/10'} flex items-center justify-center mb-3`

  const body = (
    <>
      {iconHref ? (
        <Link
          href={iconHref}
          title={iconTitle}
          aria-label={iconTitle}
          className={`${badgeCls} hover:bg-mark/25 hover:scale-105 transition-all`}
        >
          {icon}
        </Link>
      ) : (
        <span className={badgeCls}>{icon}</span>
      )}
      <p className="text-2xl font-bold text-ink tabular-nums">{value}</p>
      <p className="text-xs text-ink-soft mt-1">{label}</p>
      {subline && <p className="text-xs text-ink-faint mt-0.5 leading-snug">{subline}</p>}
      {subMetrics && subMetrics.length > 0 && (
        <div className="mt-3 pt-3 border-t border-rule space-y-1.5">
          {subMetrics.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-ink-faint shrink-0">{row.label}</span>
              <span className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-medium text-ink-soft truncate">{row.value}</span>
                {row.growth !== null ? (
                  <span
                    className={`flex items-center gap-0.5 text-[10px] font-semibold shrink-0 ${
                      row.growth >= 0 ? 'text-ok' : 'text-danger'
                    }`}
                  >
                    {row.growth >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {Math.abs(row.growth)}%
                  </span>
                ) : (
                  // 비교할 값이 없는 구간 — 억지 % 대신 –
                  <span className="text-[10px] text-ink-faint shrink-0" title="비교 데이터 없음">–</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const cardCls = 'flex flex-col items-start bg-paper-raised border border-rule rounded-2xl p-5'
  if (href) {
    return (
      <Link href={href} className={`${cardCls} hover:border-mark/40 transition-colors`}>
        {body}
      </Link>
    )
  }
  return <div className={cardCls}>{body}</div>
}
