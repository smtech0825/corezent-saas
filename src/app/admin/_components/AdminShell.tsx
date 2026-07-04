'use client'

/**
 * @컴포넌트: AdminShell
 * @설명: 관리자 패널 외부 쉘 — 모바일 햄버거, 상단 헤더, 사이드바 통합
 *        페이퍼(라이트) 테마 · 강조색=인주 빨강(accent-seal)
 */

import { useState } from 'react'
import { Menu } from 'lucide-react'
import AdminSidebar from './AdminSidebar'

interface Props {
  user: { email: string; name: string; initials: string }
  supportBadge?: number
  children: React.ReactNode
}

export default function AdminShell({ user, supportBadge = 0, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="theme-paper accent-seal bg-paper text-ink min-h-screen flex">
      {/* 데스크톱 사이드바 */}
      <div className="hidden lg:flex lg:flex-col">
        <div className="h-screen sticky top-0">
          <AdminSidebar user={user} supportBadge={supportBadge} />
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
            <AdminSidebar user={user} supportBadge={supportBadge} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 상단 헤더 — sticky 요소의 backdrop-filter는 스크롤 중 매 프레임 재블러로
         * GPU 스톨(프리징)을 유발하므로 불투명 배경 사용(성능) */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-rule bg-paper sticky top-0 z-10">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-ink-soft hover:text-ink p-1"
            >
              <Menu size={20} />
            </button>
            <span className="text-ink font-semibold text-sm">관리자 패널</span>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-xs font-semibold bg-mark/10 text-mark border border-mark/25 rounded px-2 py-1 uppercase tracking-wider">
              관리자 패널
            </span>
          </div>
          <div className="hidden sm:block text-xs text-ink-faint truncate max-w-[200px] lg:max-w-none">
            로그인 계정 <span className="text-ink-soft">{user.email}</span>
          </div>
        </div>

        {/* 페이지 콘텐츠 — 스크롤은 문서(body)가 담당. overflow-y-auto는 실제 내부 스크롤을 만들지 않으면서
         * 편집기 툴바 등의 position:sticky를 이 컨테이너에 가둬(무력화) 버리므로 두지 않는다. */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
