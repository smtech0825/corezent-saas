'use client'

/**
 * @컴포넌트: DashboardSidebar
 * @설명: 대시보드 사이드바 — 네비게이션, Support 알림 뱃지, 사용자 정보, 로그아웃
 *        isAdmin이 true인 경우 하단에 'Go to Admin' 버튼 표시
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Key, CreditCard, Settings, LogOut, X, HelpCircle, History, ExternalLink } from 'lucide-react'
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
    { label: 'Overview',  href: '/dashboard',          icon: LayoutDashboard, exact: true,  badge: 0 },
    { label: 'Licenses',  href: '/dashboard/licenses', icon: Key,             exact: false, badge: 0 },
    { label: 'Billing',   href: '/dashboard/billing',  icon: CreditCard,      exact: false, badge: 0 },
    { label: 'Changelog', href: '/changelog',          icon: History,         exact: false, badge: 0 },
    { label: 'Settings',  href: '/dashboard/settings', icon: Settings,        exact: false, badge: 0 },
    { label: 'Support',   href: '/dashboard/support',  icon: HelpCircle,      exact: false, badge: supportBadge },
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
    <aside className="w-60 shrink-0 h-full flex flex-col bg-[#0B1120] border-r border-[#1E293B]">
      {/* 로고 + 닫기 (모바일) */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-[#1E293B]">
        <Link href="/" className="flex items-center gap-2 font-bold text-white">
          <span className="w-7 h-7 rounded-lg bg-[#38BDF8] flex items-center justify-center text-[#0B1120] text-sm font-black">
            C
          </span>
          CoreZent
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-[#94A3B8] hover:text-white p-1">
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
                  ? 'bg-[#38BDF8]/10 text-[#38BDF8]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/60'
              }`}
            >
              <Icon size={16} className={active ? 'text-[#38BDF8]' : ''} />
              <span className="flex-1">{item.label}</span>
              {/* 알림 뱃지 */}
              {item.badge > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* 사용자 정보 + (관리자 전용) Go to Admin + 로그아웃 */}
      <div className="px-3 py-4 border-t border-[#1E293B]">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <span className="w-8 h-8 rounded-full bg-[#38BDF8]/20 border border-[#38BDF8]/30 flex items-center justify-center text-xs font-bold text-[#38BDF8] shrink-0">
            {user.initials}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">{user.name}</p>
            <p className="text-xs text-[#475569] truncate">{user.email}</p>
          </div>
        </div>

        {/* 관리자 전용: Go to Admin 버튼 */}
        {isAdmin && (
          <Link
            href="/admin"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/5 transition-colors mb-0.5"
          >
            <ExternalLink size={16} />
            Go to Admin
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </aside>
  )
}
