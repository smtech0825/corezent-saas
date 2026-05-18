/**
 * @파일: app/not-found.tsx
 * @설명: 404 페이지 — 존재하지 않는 경로 접근 시 표시
 */

import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '페이지를 찾을 수 없습니다 — CoreZent',
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center px-6">
      {/* Glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(56,189,248,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 text-center max-w-md">
        <p className="text-7xl sm:text-8xl font-bold text-[#38BDF8] tracking-tight mb-4">404</p>
        <h1 className="text-2xl font-bold text-white mb-3">페이지를 찾을 수 없습니다</h1>
        <p className="text-[#94A3B8] text-sm leading-relaxed mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.<br />
          주소를 다시 확인해 주세요.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold px-6 py-3 rounded-xl text-sm hover:bg-[#0ea5e9] transition-colors"
          >
            <Home size={15} />
            홈으로 가기
          </Link>
          <Link
            href="/product"
            className="inline-flex items-center justify-center gap-2 border border-[#1E293B] text-[#F1F5F9] font-medium px-6 py-3 rounded-xl text-sm hover:border-[#38BDF8]/40 transition-colors"
          >
            <ArrowLeft size={15} />
            제품 둘러보기
          </Link>
        </div>
      </div>
    </div>
  )
}
