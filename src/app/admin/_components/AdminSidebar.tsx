'use client'

/**
 * @컴포넌트: AdminSidebar
 * @설명: 관리자 패널 사이드바 — 그룹별 네비게이션, Support 알림 뱃지, Frontend 섹션 접기/펼치기
 *        페이퍼(라이트) 테마 · 강조색=인주 빨강(mark) · 활성 항목=색인 탭(리본)
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useLayoutEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingBag,
  Key,
  Gift,
  MessageSquare,
  Inbox,
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
  Scale,
  FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NAV_ICON_SIZE, NAV_ICON_STROKE } from '@/components/common/nav-icon'
import UnreadDot from '@/components/common/UnreadDot'

/** 메뉴 항목 한 개 — exact는 '개요'처럼 정확 일치가 필요한 항목만 true */
interface NavItem {
  label: string
  href: string
  icon: typeof LayoutDashboard
  exact?: boolean
}

const mainNav: NavItem[] = [
  { label: '개요',       href: '/admin',          icon: LayoutDashboard, exact: true },
  { label: '사용자',     href: '/admin/users',     icon: Users },
  { label: '제품',       href: '/admin/products',  icon: Package },
  { label: '주문',       href: '/admin/orders',    icon: ShoppingBag },
  { label: '매출',       href: '/admin/revenue',   icon: TrendingUp },
  { label: '라이선스',   href: '/admin/licenses',  icon: Key },
  { label: '세금 룰',    href: '/admin/tax',       icon: Scale },
  { label: '제휴',       href: '/admin/affiliates', icon: Gift },
  { label: '고객지원',   href: '/admin/support',   icon: MessageSquare },
  { label: '문의',       href: '/admin/inquiries', icon: Inbox },
  { label: '견적 요청',  href: '/admin/quotes',    icon: FileText },
]

const frontendNav: NavItem[] = [
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

// 시스템 그룹 — 기존에 하드코딩돼 있던 두 링크를 데이터로 옮긴 것(항목·순서·링크 불변)
const systemNav: NavItem[] = [
  { label: '설정',          href: '/admin/settings', icon: Settings },
  { label: '모니터링 로그', href: '/admin/logs',     icon: Activity },
]

/** 그룹 3개 — 라벨·항목·순서는 기존 그대로. 세 그룹 모두 접을 수 있다 */
const GROUPS = [
  { key: 'main',     label: '관리자',     items: mainNav },
  { key: 'frontend', label: '프론트엔드', items: frontendNav },
  { key: 'system',   label: '시스템',     items: systemNav },
]

/** 접힘 상태를 기억하는 브라우저 저장 키 — 이 저장소는 이미 localStorage를 쓴다(아이디 저장 등) */
const GROUP_STATE_KEY = 'corezent_admin_sidebar_groups'

// 저장된 접힘 상태 복원은 첫 화면이 그려지기 전에 해야 "펼쳐졌다 접히는" 깜빡임이 없다.
// useLayoutEffect는 서버 렌더에서 경고가 나므로 서버에서는 useEffect로 대체한다.
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * @함수명: itemActive
 * @설명: 메뉴 항목이 현재 경로에서 활성인지 판정합니다(기존 isActive와 같은 규칙).
 * @매개변수: pathname - 현재 경로 / href - 항목 경로 / exact - 정확 일치 여부
 * @반환값: 활성이면 true
 */
function itemActive(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href
  return pathname.startsWith(href)
}

/**
 * @함수명: groupOfPath
 * @설명: 현재 경로가 어느 그룹에 속하는지 찾습니다 — 접힌 그룹 안의 화면에 도착하면
 *        그 그룹을 자동으로 펼치기 위한 판정입니다.
 * @매개변수: pathname - 현재 경로
 * @반환값: 그룹 key. 어느 그룹에도 없으면 null
 */
function groupOfPath(pathname: string): string | null {
  for (const g of GROUPS) {
    if (g.items.some((it) => itemActive(pathname, it.href, it.exact))) return g.key
  }
  return null
}

interface Props {
  user: { email: string; name: string; initials: string }
  supportBadge?: number
  onClose?: () => void
}

export default function AdminSidebar({ user, supportBadge = 0, onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const activeGroup = groupOfPath(pathname)

  // 그룹별 접힘 상태 — 기본: 관리자·시스템은 펼침, 프론트엔드는 그 그룹 화면일 때만
  // 펼침(기존 화면과 동일). 서버·클라이언트 첫 렌더가 같아야 해서 localStorage는
  // 아래 복원 효과에서만 읽는다.
  const [open, setOpen] = useState<Record<string, boolean>>({
    main: true, frontend: activeGroup === 'frontend', system: true,
  })

  // 저장된 접힘 상태 복원 — 단, 지금 보고 있는 화면이 속한 그룹은 항상 펼친다
  // (접힌 그룹 안에 있으면 어디 있는지 알 수 없기 때문). 첫 페인트 전에 적용해
  // "펼쳐졌다 접히는" 깜빡임을 없앤다. 저장값은 boolean인 키만 받는다(조작·손상 방어).
  useClientLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(GROUP_STATE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const saved: Record<string, boolean> = {}
        for (const key of Object.keys(parsed)) {
          if (typeof parsed[key] === 'boolean') saved[key] = parsed[key] as boolean
        }
        setOpen((prev) => ({ ...prev, ...saved, ...(activeGroup ? { [activeGroup]: true } : {}) }))
      }
    } catch { /* 저장값이 손상됐으면 기본값 유지 */ }
    // 복원은 처음 한 번만 — 이후 이동은 아래 자동 펼침 효과가 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 접힌 그룹 안의 화면으로 이동하면 그 그룹을 자동으로 펼친다.
  // 자동 펼침은 저장하지 않는다 — 사용자가 정한 접힘 기억을 이동이 덮어쓰지 않게.
  useEffect(() => {
    if (activeGroup) {
      setOpen((prev) => (prev[activeGroup] ? prev : { ...prev, [activeGroup]: true }))
    }
  }, [activeGroup])

  /**
   * @함수명: toggleGroup
   * @설명: 그룹을 접거나 펼치고, 사용자가 정한 상태를 브라우저에 기억합니다.
   * @매개변수: key - 그룹 key
   * @반환값: 없음
   */
  function toggleGroup(key: string) {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next)) } catch { /* 저장 불가 시 무시 */ }
      return next
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  function isActive(href: string, exact = false) {
    return itemActive(pathname, href, exact)
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
          <button onClick={onClose} title="메뉴 닫기" aria-label="메뉴 닫기" className="lg:hidden text-ink-soft hover:text-ink p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* 네비게이션 — 그룹 3개(관리자·프론트엔드·시스템) 모두 같은 접힘 규칙.
          항목·순서·링크는 기존 그대로다. */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto nav-scroll-shadow">
        {GROUPS.map((group, gi) => {
          const groupActive = activeGroup === group.key
          const expanded = open[group.key]
          // 그룹 안에 미읽음 표시 항목이 있는지 — 접힌 상태에서 알림이 사라지지 않게
          // 그룹 헤더에 같은 점을 올린다(검증에서 발견된 사각지대 방어)
          const groupHasBadge = supportBadge > 0 && group.items.some((it) => it.href === '/admin/support')
          return (
            <div key={group.key} className={gi > 0 ? 'mt-3' : undefined}>
              {/* 라벨 색: ink-faint(2.81:1)는 대비 미달이라 ink-soft(5.85:1)·활성은 ink.
                  모바일 오버레이도 같은 컴포넌트라 터치 높이는 모바일 44px, 데스크톱만 얇게 */}
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={expanded}
                aria-controls={`admin-nav-${group.key}`}
                className={`w-full flex items-center justify-between px-3 py-1 mb-1 min-h-11 lg:min-h-0 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                  groupActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{group.label}</span>
                  {!expanded && groupHasBadge && <UnreadDot />}
                </span>
                <ChevronDown
                  size={12}
                  className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* 접혀도 요소는 남긴다(hidden) — aria-controls 참조가 끊기지 않게 */}
              <div id={`admin-nav-${group.key}`} hidden={!expanded} className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href, item.exact)
                  const isSupport = item.href === '/admin/support'
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-medium transition-colors ${
                        active ? activeCls : idleCls
                      }`}
                    >
                      <Icon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} className={active ? 'text-mark' : ''} />
                      <span className="flex-1">{item.label}</span>
                      {/* 미읽음 뱃지 (Support 전용) */}
                      {isSupport && supportBadge > 0 && <UnreadDot />}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* 대시보드 링크 — 하단 고정 영역은 여백만 줄였다(글자 크기 불변) */}
      <div className="px-3 pt-1 border-t border-rule">
        {/* 같은 구조의 형제(다른 영역 이동 링크) — ink-faint는 대비 2.81:1로 낮아
            ink-soft(5.85:1)로 맞춘다. 대시보드 쪽 관리자 이동 링크와 같은 색 */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 lg:py-1.5 rounded-lg text-xs text-ink-soft hover:text-ink transition-colors"
        >
          ← 사용자 대시보드
        </Link>
      </div>

      {/* 사용자 정보 + 로그아웃 */}
      <div className="px-3 py-3 lg:py-2">
        <div className="flex items-center gap-3 px-3 py-2 lg:py-1.5 mb-0.5">
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
          className="w-full flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm text-danger hover:bg-danger-soft transition-colors"
        >
          <LogOut size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
