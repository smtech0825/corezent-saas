'use client'

/**
 * @컴포넌트: DashboardShell
 * @설명: 대시보드 외부 쉘 — 모바일 햄버거, 데스크톱 상단 헤더, ToastProvider
 *        페이퍼(라이트) 테마 · 강조색=볼펜 파랑(accent-pen)
 */

import { useState } from 'react'
import { Menu } from 'lucide-react'
import DashboardSidebar from './DashboardSidebar'
import { ToastProvider } from '@/components/common/Toast'

interface Props {
  user: { email: string; name: string; initials: string }
  supportBadge?: number
  isAdmin?: boolean
  children: React.ReactNode
}

export default function DashboardShell({ user, supportBadge = 0, isAdmin = false, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="theme-paper accent-pen bg-paper text-ink min-h-screen flex">
        {/* 데스크톱 사이드바 */}
        <div className="hidden lg:flex lg:flex-col">
          <div className="h-screen sticky top-0">
            <DashboardSidebar user={user} supportBadge={supportBadge} isAdmin={isAdmin} />
          </div>
        </div>

        {/* 모바일 사이드바 오버레이 */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-10 flex flex-col h-full">
              <DashboardSidebar
                user={user}
                supportBadge={supportBadge}
                isAdmin={isAdmin}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 상단 헤더 — sticky 요소의 backdrop-filter는 스크롤 중 매 프레임 재블러로
           * GPU 스톨(프리징)을 유발하므로 불투명 배경 사용(성능) */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-rule bg-paper sticky top-0 z-10">
            {/* 모바일: 햄버거 + 로고 */}
            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-ink-soft hover:text-ink p-1"
              >
                <Menu size={20} />
              </button>
              <span className="text-ink font-semibold text-sm">대시보드</span>
            </div>

            {/* 데스크톱: 빈 공간 */}
            <div className="hidden lg:block" />

            {/* 우측: 예비 공간 */}
            <div />
          </div>

          {/* 페이지 콘텐츠 */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
