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
    <div className="fixed bottom-4 left-4 z-50 w-[320px] max-w-[calc(100vw-2rem)]">
      <div className="bg-[#111A2E] border border-[#1E293B] rounded-2xl p-4 shadow-2xl shadow-black/50 backdrop-blur-sm">

        {/* 헤더 */}
        <div className="flex items-start gap-2.5 mb-3.5">
          <div className="shrink-0 w-7 h-7 mt-0.5 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center">
            <Cookie size={13} className="text-[#38BDF8]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">Cookie Preferences</p>
            <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
              We use essential cookies for security, and optional cookies for analytics &amp; personalization.{' '}
              <Link href="/legal/cookies" className="text-[#38BDF8] hover:underline">
                Learn more
              </Link>
            </p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="shrink-0 text-[#475569] hover:text-white transition-colors -mt-0.5"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        {/* GDPR 범주 요약 */}
        <div className="flex gap-1.5 mb-3.5">
          <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2 py-0.5">
            ✓ Essential
          </span>
          <span className="text-[10px] font-medium text-[#475569] bg-[#0B1120] border border-[#1E293B] rounded-full px-2 py-0.5">
            Analytics
          </span>
          <span className="text-[10px] font-medium text-[#475569] bg-[#0B1120] border border-[#1E293B] rounded-full px-2 py-0.5">
            Marketing
          </span>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handleEssential}
            className="flex-1 py-2 rounded-xl border border-[#1E293B] text-xs text-[#94A3B8] hover:text-white hover:border-[#38BDF8]/30 transition-colors font-medium"
          >
            Essential Only
          </button>
          <button
            onClick={handleAll}
            className="flex-1 py-2 rounded-xl bg-[#38BDF8] text-[#0B1120] text-xs font-semibold hover:bg-[#0ea5e9] transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  )
}
