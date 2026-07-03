'use client'

/**
 * @컴포넌트: AdminSidebar
 * @설명: 관리자 패널 사이드바 — 그룹별 네비게이션, Support 알림 뱃지, Frontend 섹션 접기/펼치기
 *        페이퍼(라이트) 테마 · 강조색=인주 빨강(mark) · 활성 항목=색인 탭(리본)
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
  Gift,
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
  TrendingUp,
  Activity,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const mainNav = [
  { label: '개요',       href: '/admin',          icon: LayoutDashboard, exact: true },
  { label: '사용자',     href: '/admin/users',     icon: Users },
  { label: '제품',       href: '/admin/products',  icon: Package },
  { label: '주문',       href: '/admin/orders',    icon: ShoppingBag },
  { label: '매출',       href: '/admin/revenue',   icon: TrendingUp },
  { label: '라이선스',   href: '/admin/licenses',  icon: Key },
  { label: '제휴',       href: '/admin/affiliates', icon: Gift },
  { label: '고객지원',   href: '/admin/support',   icon: MessageSquare },
]

const frontendNav = [
  { label: '공지 배너',    href: '/admin/content/announcement',  icon: Bell },
  { label: '섹션 설정',    href: '/admin/content/sections',     icon: List },
  { label: '히어로',       href: '/admin/content/hero',         icon: Layout },
  { label: '소개',         href: '/admin/content/about',        icon: Info },
  { label: '이용 방법',    href: '/admin/content/how-it-works', icon: Workflow },
  { label: '특징',         href: '/admin/content/features',     icon: Sparkles },
  { label: '고객 후기',    href: '/admin/content/testimonials', icon: Quote },
  { label: 'FAQ',          href: '/admin/content/faq',          icon: HelpCircle },
  { label: 'CTA',          href: '/admin/content/cta',          icon: Megaphone },
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

  // 활성 네비 항목 = 색인 탭(리본) / 비활성 = 은은한 호버
  const activeCls =
    "relative bg-paper-raised text-ink font-semibold shadow-[0_1px_2px_rgba(35,39,46,0.05)] before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-mark"
  const idleCls = 'text-ink-soft hover:text-ink hover:bg-ink/5'

  return (
    <aside className="w-60 shrink-0 h-full flex flex-col bg-paper-shade border-r border-rule">
      {/* 로고 + 관리자 뱃지 */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-rule">
        <Link href="/admin" className="flex items-center gap-2 font-bold text-ink">
          <span className="w-7 h-7 rounded-lg bg-mark flex items-center justify-center text-white text-sm font-black">
            A
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm">CoreZent</span>
            <span className="text-[9px] font-semibold text-mark tracking-widest uppercase">
              관리자 패널
            </span>
          </span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-ink-soft hover:text-ink p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {/* 메인 */}
        <p className="px-3 mb-1 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">
          관리자
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
                active ? activeCls : idleCls
              }`}
            >
              <Icon size={16} className={active ? 'text-mark' : ''} />
              <span className="flex-1">{item.label}</span>
              {/* 미읽음 뱃지 (Support 전용) */}
              {isSupport && supportBadge > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
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
              isFrontendActive ? 'text-mark' : 'text-ink-faint hover:text-ink'
            }`}
          >
            <span>프론트엔드</span>
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
                      active ? activeCls : idleCls
                    }`}
                  >
                    <Icon size={15} className={active ? 'text-mark' : ''} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 설정 */}
        <div className="mt-4">
          <p className="px-3 mb-1 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">
            시스템
          </p>
          <Link
            href="/admin/settings"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/admin/settings') ? activeCls : idleCls
            }`}
          >
            <Settings size={16} className={isActive('/admin/settings') ? 'text-mark' : ''} />
            설정
          </Link>
          <Link
            href="/admin/logs"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/admin/logs') ? activeCls : idleCls
            }`}
          >
            <Activity size={16} className={isActive('/admin/logs') ? 'text-mark' : ''} />
            모니터링 로그
          </Link>
        </div>
      </nav>

      {/* 대시보드 링크 */}
      <div className="px-3 pt-2 border-t border-rule">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-ink-faint hover:text-ink transition-colors"
        >
          ← 사용자 대시보드
        </Link>
      </div>

      {/* 사용자 정보 + 로그아웃 */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <span className="w-8 h-8 rounded-full bg-mark/15 border border-mark/30 flex items-center justify-center text-xs font-bold text-mark shrink-0">
            {user.initials}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink font-medium truncate">{user.name}</p>
            <p className="text-xs text-ink-faint truncate">{user.email}</p>
          </div>
        </div>
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
