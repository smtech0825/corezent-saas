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

// 페이지당 한 번만 조회 — 같은 페이지에 버튼이 여러 개(메뉴·모바일·요금)라도
// 첫 인스턴스의 요청을 전부가 공유한다(모듈 수준 캐시).
let trialUrlPromise: Promise<string> | null = null

/**
 * @함수명: loadTrialUrl
 * @설명: 신청 주소를 공개 API에서 한 번만 읽어 옵니다. 실패하면 ''(버튼 숨김).
 * @반환값: 신청 주소 또는 ''
 */
function loadTrialUrl(): Promise<string> {
  trialUrlPromise ??= (async () => {
    try {
      const res = await fetch('/api/trial-url')
      if (!res.ok) return ''
      const data = (await res.json()) as { url?: string }
      return data.url ?? ''
    } catch {
      return ''
    }
  })()
  return trialUrlPromise
}

export default function TrialApplyButton({ placement, showNote = false, className = '' }: Props) {
  // 신청 주소 — 읽기 전(null)·조회 실패('')에는 버튼을 그리지 않는다
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const loaded = await loadTrialUrl()
      if (alive) setUrl(loaded)
    })()
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
        // 상단 메뉴는 1024px 폭에서 10px가 모자라 좌우 여백만 줄인다(px-4! — 높이 44px는 유지).
        // 실측: 메뉴 필요 폭 1034px → px-4 적용 시 1018px(미리보기 배포에서 확인)
        className={`w-full whitespace-nowrap ${placement === 'nav' ? 'px-4!' : ''}`}
      >
        무료 체험 신청
      </Button>
      {showNote && (
        <span className="text-xs text-ink-faint">신청하시면 안내드립니다</span>
      )}
    </span>
  )
}
