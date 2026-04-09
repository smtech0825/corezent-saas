'use client'

/**
 * @컴포넌트: AdminSidebar
 * @설명: 관리자 패널 사이드바 — 그룹별 네비게이션, Support 알림 뱃지, Frontend 섹션 접기/펼치기
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingBag,
  Key,
  MessageSquare,
  Settings,
  LogOut,
  X,
  ChevronDown,
  List,
  HelpCircle,
  Sparkles,
  Quote,
  Layout,
  Workflow,
  Megaphone,
  Bell,
  Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const mainNav = [
  { label: 'Overview',  href: '/admin',          icon: LayoutDashboard, exact: true },
  { label: 'Users',     href: '/admin/users',     icon: Users },
  { label: 'Products',  href: '/admin/products',  icon: Package },
  { label: 'Orders',    href: '/admin/orders',    icon: ShoppingBag },
  { label: 'Licenses',  href: '/admin/licenses',  icon: Key },
  { label: 'Support',   href: '/admin/support',   icon: MessageSquare },
]

const frontendNav = [
  { label: 'Announcement',     href: '/admin/content/announcement',  icon: Bell },
  { label: 'Section Settings', href: '/admin/content/sections',     icon: List },
  { label: 'Hero',             href: '/admin/content/hero',         icon: Layout },
  { label: 'About',            href: '/admin/content/about',        icon: Info },
  { label: 'How It Works',     href: '/admin/content/how-it-works', icon: Workflow },
  { label: 'Why',              href: '/admin/content/features',     icon: Sparkles },
  { label: 'Testimonials',     href: '/admin/content/testimonials', icon: Quote },
  { label: 'FAQ',              href: '/admin/content/faq',          icon: HelpCircle },
  { label: 'CTA',              href: '/admin/content/cta',          icon: Megaphone },
]

interface Props {
  user: { email: string; name: string; initials: string }
  supportBadge?: number
  onClose?: () => void
}

export default function AdminSidebar({ user, supportBadge = 0, onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const isFrontendActive = pathname.startsWith('/admin/content')
  const [frontendOpen, setFrontendOpen] = useState(isFrontendActive)

  useEffect(() => {
    if (isFrontendActive) setFrontendOpen(true)
  }, [isFrontendActive])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-60 shrink-0 h-full flex flex-col bg-[#0B1120] border-r border-[#1E293B]">
      {/* 로고 + 관리자 뱃지 */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-[#1E293B]">
        <Link href="/admin" className="flex items-center gap-2 font-bold text-white">
          <span className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-[#0B1120] text-sm font-black">
            A
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm">CoreZent</span>
            <span className="text-[9px] font-semibold text-amber-400 tracking-widest uppercase">
              Admin Panel
            </span>
          </span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-[#94A3B8] hover:text-white p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {/* 메인 */}
        <p className="px-3 mb-1 text-[10px] font-semibold text-[#475569] uppercase tracking-widest">
          Admin
        </p>
        {mainNav.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href, item.exact)
          const isSupport = item.href === '/admin/support'
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/60'
              }`}
            >
              <Icon size={16} className={active ? 'text-amber-400' : ''} />
              <span className="flex-1">{item.label}</span>
              {/* 미읽음 뱃지 (Support 전용) */}
              {isSupport && supportBadge > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                </span>
              )}
            </Link>
          )
        })}

        {/* Frontend 그룹 (접기/펼치기) */}
        <div className="mt-4">
          <button
            onClick={() => setFrontendOpen((v) => !v)}
            className={`w-full flex items-center justify-between px-3 py-1 mb-1 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
              isFrontendActive ? 'text-amber-400' : 'text-[#475569] hover:text-[#94A3B8]'
            }`}
          >
            <span>Frontend</span>
            <ChevronDown
              size={12}
              className={`transition-transform ${frontendOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {frontendOpen && (
            <div className="flex flex-col gap-0.5">
              {frontendNav.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/60'
                    }`}
                  >
                    <Icon size={15} className={active ? 'text-amber-400' : ''} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 설정 */}
        <div className="mt-4">
          <p className="px-3 mb-1 text-[10px] font-semibold text-[#475569] uppercase tracking-widest">
            System
          </p>
          <Link
            href="/admin/settings"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/admin/settings')
                ? 'bg-amber-500/10 text-amber-400'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/60'
            }`}
          >
            <Settings size={16} className={isActive('/admin/settings') ? 'text-amber-400' : ''} />
            Settings
          </Link>
        </div>
      </nav>

      {/* 대시보드 링크 */}
      <div className="px-3 pt-2 border-t border-[#1E293B]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#475569] hover:text-[#94A3B8] transition-colors"
        >
          ← User Dashboard
        </Link>
      </div>

      {/* 사용자 정보 + 로그아웃 */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <span className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
            {user.initials}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">{user.name}</p>
            <p className="text-xs text-[#475569] truncate">{user.email}</p>
          </div>
        </div>
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
