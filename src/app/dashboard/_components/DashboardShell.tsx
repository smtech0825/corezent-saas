'use client'

/**
 * @컴포넌트: DashboardShell
 * @설명: 대시보드 외부 쉘 — 모바일 햄버거, 데스크톱 상단 헤더, ToastProvider
 */

import { useState } from 'react'
import { Menu } from 'lucide-react'
import DashboardSidebar from './DashboardSidebar'

import { ToastProvider } from '@/components/common/Toast'

interface Props {
  user: { email: string; name: string; initials: string }
  supportBadge?: number
  children: React.ReactNode
}

export default function DashboardShell({ user, supportBadge = 0, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#0B1120] flex">
        {/* 데스크톱 사이드바 */}
        <div className="hidden lg:flex lg:flex-col">
          <div className="h-screen sticky top-0">
            <DashboardSidebar user={user} supportBadge={supportBadge} />
          </div>
        </div>

        {/* 모바일 사이드바 오버레이 */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-10 flex flex-col h-full">
              <DashboardSidebar user={user} supportBadge={supportBadge} onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 상단 헤더 */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-[#1E293B] bg-[#0B1120] sticky top-0 z-10">
            {/* 모바일: 햄버거 + 로고 */}
            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-[#94A3B8] hover:text-white p-1"
              >
                <Menu size={20} />
              </button>
              <span className="text-white font-semibold text-sm">Dashboard</span>
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
