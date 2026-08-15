'use client'

/**
 * @컴포넌트: TrialApplyButton
 * @설명: 무료 체험 신청 버튼 — 공용 부품 한 벌(상단 메뉴 데스크톱·모바일, 요금 페이지 공유.
 *        복사 금지). 신청 주소는 공개 API(/api/trial-url — 관리자 설정 front_settings)에서
 *        읽으며, 주소를 아직 못 읽었거나 비어 있으면 버튼을 아예 그리지 않는다
 *        (눌러도 아무 데도 안 가는 버튼 금지). 외부 주소라 새 창으로 연다(Button external).
 *        ⚠️ 체험 기간·횟수·제한 문구를 여기든 어디든 절대 적지 말 것 — 정해진 것이 없다.
 *        구매 버튼(primary 채움)과 구분되도록 outline 모양을 쓴다.
 */

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { EVENT, trackEvent } from '@/lib/analytics-events'

interface Props {
  /** 놓인 자리 — 흐름 측정용 구분값(개인정보 아님) */
  placement: 'nav' | 'nav-mobile' | 'pricing'
  /** true면 버튼 아래에 안내문(「신청하시면 안내드립니다」)을 붙인다 — 자리가 있는 곳만 */
  showNote?: boolean
  className?: string
}

export default function TrialApplyButton({ placement, showNote = false, className = '' }: Props) {
  // 신청 주소 — 읽기 전(null)·조회 실패('')에는 버튼을 그리지 않는다
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/trial-url')
      .then((r) => (r.ok ? r.json() : { url: '' }))
      .then((d: { url?: string }) => { if (alive) setUrl(d.url ?? '') })
      .catch(() => { if (alive) setUrl('') })
    return () => { alive = false }
  }, [])

  if (!url) return null

  return (
    // 측정은 감싼 요소의 클릭(버블링)으로 — 공용 Button(외부 링크 분기)은 onClick을 받지
    // 않으며 공용 부품은 고치지 않는다. 측정 실패해도 링크 이동(본 동작)은 그대로 진행된다.
    <span
      className={`inline-flex flex-col items-center gap-1.5 ${className}`}
      onClick={() => trackEvent(EVENT.TRIAL_APPLY_CLICK, { placement })}
    >
      <Button
        href={url}
        external
        variant="outline"
        size="md"
        className="w-full whitespace-nowrap"
      >
        무료 체험 신청
      </Button>
      {showNote && (
        <span className="text-xs text-ink-faint">신청하시면 안내드립니다</span>
      )}
    </span>
  )
}
