'use client'

/**
 * @컴포넌트: ScrollTopButton
 * @설명: 상품 상세 페이지 플로팅 '맨 위로' 버튼.
 *        일정 스크롤(THRESHOLD) 이상 내려가면 부드럽게 나타나고, 하단 고정 구매 바(--buy-bar-h) 바로 위
 *        오른쪽 아래에 위치한다(바가 없으면 하단 기본 여백). 클릭 시 페이지 최상단으로 부드럽게 이동한다.
 */

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

// 이 정도 내려가면 버튼 노출(px)
const THRESHOLD = 400

export default function ScrollTopButton() {
  const [visible, setVisible] = useState(false)

  // 스크롤 위치를 구독해 THRESHOLD 초과 시 노출 (passive 리스너로 스크롤 성능 영향 최소화)
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > THRESHOLD)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      aria-label="맨 위로"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      // 구매 바 바로 위 오른쪽 아래 — bottom은 바 높이(--buy-bar-h)+간격, 바가 없으면 24px 기본 여백.
      // 좌우는 본문 패딩(px-4 sm:px-6)과 같은 기준선. 모바일은 누르는 영역 44px(min-h-11) 확보.
      style={{ bottom: 'calc(var(--buy-bar-h, 24px) + 16px)' }}
      className={`fixed right-4 sm:right-6 z-[55] inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper/95 backdrop-blur px-4 py-2 min-h-11 sm:min-h-0 text-xs font-semibold text-ink-soft shadow-[0_4px_16px_rgba(35,39,46,0.14)] transition-all duration-300 hover:text-ink hover:border-pen/40 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <ArrowUp size={14} />
      맨 위로
    </button>
  )
}
