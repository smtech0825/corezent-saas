'use client'

/**
 * @컴포넌트: CookieConsentBanner
 * @설명: GDPR / CCPA 쿠키 동의 배너
 *        화면 좌측 하단 플로팅 위젯 — 필수 쿠키만 허용 | 모두 허용
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'
import { getConsent, setConsent } from '@/lib/cookies'

export default function CookieConsentBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // 동의 기록이 없을 때만 배너 표시 (0.6초 지연 — 페이지 로드 후 자연스럽게)
    if (!getConsent()) {
      const t = setTimeout(() => setShow(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  if (!show) return null

  function handleEssential() {
    setConsent('essential')
    setShow(false)
  }

  function handleAll() {
    setConsent('all')
    setShow(false)
  }

  return (
    <div
      // 상품 상세의 하단 고정 구매 바(z-60)가 배너 버튼 줄을 덮지 않게, 바 높이(--buy-bar-h)만큼 위로.
      // 바가 없는 화면에서는 변수가 비어 기존과 같은 16px 여백이 된다.
      // z는 '맨 위로' 버튼(z-55)·구매 바(z-60)보다 위, 드롭업 메뉴(z-70)보다 아래 —
      // 좁은 화면에서 버튼과 자리가 겹쳐도 동의 버튼 클릭을 배너가 가져간다(동의가 우선).
      style={{ bottom: 'calc(var(--buy-bar-h, 0px) + 1rem)' }}
      className="fixed left-4 z-[65] w-[320px] max-w-[calc(100vw-2rem)]"
    >
      {/* 페이퍼(공문서) 테마 토큰만 사용 — 사이트가 라이트 테마로 바뀐 뒤에도 이 배너만
          옛 딥네이비 색을 고정값으로 들고 있어 크림색 지면 위에 어두운 위젯으로 떠 있었다.
          글자색은 전부 대비 4.5:1 이상(측정 4.63~14.99). 특히 옛 #475569는 2.29:1이었다. */}
      <div className="bg-paper-raised border border-rule rounded-card p-4 shadow-lg">

        {/* 헤더 */}
        <div className="flex items-start gap-2.5 mb-3.5">
          <div className="shrink-0 w-7 h-7 mt-0.5 rounded-lg bg-pen/10 border border-pen/25 flex items-center justify-center">
            <Cookie size={13} className="text-pen" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink leading-tight">쿠키 설정</p>
            <p className="text-xs text-ink-soft mt-1 leading-relaxed">
              보안을 위한 필수 쿠키와 분석·맞춤화를 위한 선택 쿠키를 사용합니다.{' '}
              <Link href="/legal/cookies" className="text-pen hover:underline">
                자세히 보기
              </Link>
            </p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="shrink-0 text-ink-faint hover:text-ink transition-colors -mt-0.5"
            aria-label="닫기"
          >
            <X size={14} />
          </button>
        </div>

        {/* GDPR 범주 요약 — 필수는 성공색, 선택 항목은 보조 글자색 */}
        <div className="flex gap-1.5 mb-3.5">
          <span className="text-xs font-medium text-ok bg-ok-soft border border-ok/30 rounded-full px-2 py-0.5">
            ✓ 필수
          </span>
          <span className="text-xs font-medium text-ink-soft bg-paper-shade border border-rule rounded-full px-2 py-0.5">
            분석
          </span>
          <span className="text-xs font-medium text-ink-soft bg-paper-shade border border-rule rounded-full px-2 py-0.5">
            마케팅
          </span>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handleEssential}
            className="flex-1 py-2 rounded-xl border border-rule text-xs text-ink-soft hover:text-ink hover:border-pen/40 transition-colors font-medium"
          >
            필수만 허용
          </button>
          <button
            onClick={handleAll}
            className="flex-1 py-2 rounded-xl bg-pen text-white text-xs font-semibold hover:bg-pen-dark transition-colors"
          >
            모두 허용
          </button>
        </div>
      </div>
    </div>
  )
}
