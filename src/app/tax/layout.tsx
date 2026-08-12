/**
 * @파일: tax/layout.tsx
 * @설명: /tax 공유 레이아웃 — 모든 부동산 계산기가 공유하는 껍데기(테마·Navbar·Footer +
 *        허브 제목 + 계산기 전환 탭). 계산기를 바꿔도 이 레이아웃은 리렌더 없이 유지되고
 *        children(계산 영역)만 교체된다 — 주소는 계산기마다 바뀌지만 페이지 전체가
 *        새로 로드되지 않으며, 브라우저 뒤로가기도 정상 동작한다(App Router 표준 동작).
 */

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import TaxNav from './_components/TaxNav'

export default function TaxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-paper min-h-screen bg-paper text-ink font-sans">
      <Navbar />

      {/* 허브 제목 + 계산기 전환 탭 — 계산기 페이지들 위에 항상 유지된다 */}
      <div className="pt-8 px-4 sm:px-6 text-center">
        <Link
          href="/tax"
          className="inline-block text-xs font-semibold tracking-widest text-ink-soft hover:text-pen transition-colors"
        >
          부동산 계산기
        </Link>
        <div className="mt-3">
          <TaxNav />
        </div>
      </div>

      {children}

      <Footer />
    </div>
  )
}
