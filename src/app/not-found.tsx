/**
 * @파일: app/not-found.tsx
 * @설명: 404 페이지 — 존재하지 않는 경로 접근 시 표시
 */

import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata = {
  title: '페이지를 찾을 수 없습니다',
}

export default function NotFound() {
  return (
    <div className="theme-paper min-h-screen bg-paper font-sans text-ink flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="relative z-10 text-center max-w-md">
        <p className="text-7xl sm:text-8xl font-bold text-mark tracking-tight mb-4">404</p>
        <h1 className="text-2xl font-bold text-ink font-serif mb-3">페이지를 찾을 수 없습니다</h1>
        <p className="text-ink-soft text-sm leading-relaxed mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.<br />
          주소를 다시 확인해 주세요.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-mark text-white font-semibold px-6 py-3 rounded-md text-sm hover:brightness-95 transition-colors"
          >
            <Home size={15} />
            홈으로 가기
          </Link>
          <Link
            href="/product"
            className="inline-flex items-center justify-center gap-2 border border-rule text-ink font-medium px-6 py-3 rounded-md text-sm hover:border-mark/40 transition-colors"
          >
            <ArrowLeft size={15} />
            제품 둘러보기
          </Link>
        </div>
      </div>
      </main>
      <Footer />
    </div>
  )
}
