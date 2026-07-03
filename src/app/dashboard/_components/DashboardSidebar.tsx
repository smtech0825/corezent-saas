'use client'

/**
 * @컴포넌트: DashboardSidebar
 * @설명: 대시보드 사이드바 — 네비게이션, Support 알림 뱃지, 사용자 정보, 로그아웃
 *        isAdmin이 true인 경우 하단에 'Go to Admin' 버튼 표시
 *        페이퍼(라이트) 테마 · 강조색=볼펜 파랑(mark) · 활성 항목=색인 탭(리본)
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Key, CreditCard, Gift, Settings, LogOut, X, HelpCircle, History, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  user: { email: string; name: string; initials: string }
  supportBadge?: number
  isAdmin?: boolean
  onClose?: () => void
}

export default function DashboardSidebar({ user, supportBadge = 0, isAdmin = false, onClose }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const navItems = [
    { label: '개요',        href: '/dashboard',          icon: LayoutDashboard, exact: true,  badge: 0 },
    { label: '라이선스',    href: '/dashboard/licenses', icon: Key,             exact: false, badge: 0 },
    { label: '결제',        href: '/dashboard/billing',  icon: CreditCard,      exact: false, badge: 0 },
    { label: '제휴',        href: '/dashboard/affiliate', icon: Gift,            exact: false, badge: 0 },
    { label: '업데이트 내역', href: '/changelog',         icon: History,         exact: false, badge: 0 },
    { label: '설정',        href: '/dashboard/settings', icon: Settings,        exact: false, badge: 0 },
    { label: '고객지원',    href: '/dashboard/support',  icon: HelpCircle,      exact: false, badge: supportBadge },
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  function isActive(item: typeof navItems[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <aside className="w-60 shrink-0 h-full flex flex-col bg-paper-shade border-r border-rule">
      {/* 로고 + 닫기 (모바일) */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-rule">
        <Link href="/" className="flex items-center gap-2 font-bold text-ink">
          <span className="w-7 h-7 rounded-lg bg-mark flex items-center justify-center text-white text-sm font-black">
            C
          </span>
          CoreZent
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-ink-soft hover:text-ink p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon   = item.icon
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "relative bg-paper-raised text-ink font-semibold shadow-[0_1px_2px_rgba(35,39,46,0.05)] before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-mark"
                  : 'text-ink-soft hover:text-ink hover:bg-ink/5'
              }`}
            >
              <Icon size={16} className={active ? 'text-mark' : ''} />
              <span className="flex-1">{item.label}</span>
              {/* 알림 뱃지 */}
              {item.badge > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* 사용자 정보 + (관리자 전용) Go to Admin + 로그아웃 */}
      <div className="px-3 py-4 border-t border-rule">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <span className="w-8 h-8 rounded-full bg-mark/15 border border-mark/30 flex items-center justify-center text-xs font-bold text-mark shrink-0">
            {user.initials}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink font-medium truncate">{user.name}</p>
            <p className="text-xs text-ink-faint truncate">{user.email}</p>
          </div>
        </div>

        {/* 관리자 전용: Go to Admin 버튼 — 인주 빨강으로 관리자 영역임을 힌트 */}
        {isAdmin && (
          <Link
            href="/admin"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-seal hover:bg-seal/8 transition-colors mb-0.5"
          >
            <ExternalLink size={16} />
            관리자 페이지로 이동
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-danger hover:bg-danger-soft transition-colors"
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
