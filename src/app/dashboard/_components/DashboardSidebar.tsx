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
import { NAV_ICON_SIZE, NAV_ICON_STROKE } from '@/components/common/nav-icon'
import UnreadDot from '@/components/common/UnreadDot'

/** 대시보드 메뉴 정의 — 단일 출처. 상단 헤더의 현재 페이지 이름도 여기서 가져간다
 *  (따로 목록을 만들면 사본이 되어 한쪽만 고쳐진다) */
export const DASHBOARD_NAV = [
  { label: '개요',        href: '/dashboard',          icon: LayoutDashboard, exact: true  },
  { label: '라이선스',    href: '/dashboard/licenses', icon: Key,             exact: false },
  { label: '결제',        href: '/dashboard/billing',  icon: CreditCard,      exact: false },
  { label: '제휴',        href: '/dashboard/affiliate', icon: Gift,            exact: false },
  { label: '업데이트 내역', href: '/changelog',         icon: History,         exact: false },
  { label: '설정',        href: '/dashboard/settings', icon: Settings,        exact: false },
  { label: '고객지원',    href: '/dashboard/support',  icon: HelpCircle,      exact: false },
]

/**
 * @함수명: matchesNav
 * @설명: 경로가 메뉴 항목에 해당하는지 판정합니다(개요=정확 일치, 나머지=시작 일치).
 *        사이드바 활성 표시와 헤더 페이지 이름이 같은 판정을 쓰는 유일한 기준 —
 *        두 벌로 갈리면 한쪽만 고쳐져 이름과 강조가 어긋난다.
 * @매개변수: pathname - 현재 경로 / item - 메뉴 항목
 * @반환값: 해당하면 true
 */
function matchesNav(pathname: string, item: (typeof DASHBOARD_NAV)[number]): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href)
}

/**
 * @함수명: dashboardPageLabel
 * @설명: 현재 경로가 어느 메뉴 화면인지 찾아 그 메뉴 이름을 돌려줍니다.
 *        메뉴에 없는 화면이면 null — 부르는 쪽은 빈 채로 둔다(이름을 지어내지 않는다).
 * @매개변수: pathname - 현재 경로
 * @반환값: 메뉴 이름 또는 null
 */
export function dashboardPageLabel(pathname: string): string | null {
  return DASHBOARD_NAV.find((item) => matchesNav(pathname, item))?.label ?? null
}

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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // 활성 판정 — 헤더 페이지 이름(dashboardPageLabel)과 같은 함수를 쓴다
  function isActive(item: (typeof DASHBOARD_NAV)[number]) {
    return matchesNav(pathname, item)
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
          <button onClick={onClose} title="메뉴 닫기" aria-label="메뉴 닫기" className="lg:hidden text-ink-soft hover:text-ink p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* 네비게이션 */}
      {/* 스크롤이 생길 만큼 길어지면 위·아래 그림자로 알린다(짧으면 아무 변화 없음) */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto nav-scroll-shadow">
        {DASHBOARD_NAV.map((item) => {
          const Icon   = item.icon
          const active = isActive(item)
          const badge  = item.href === '/dashboard/support' ? supportBadge : 0
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
              <Icon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} className={active ? 'text-mark' : ''} />
              <span className="flex-1">{item.label}</span>
              {/* 알림 뱃지 — 공용 UnreadDot(관리자 사이드바와 같은 정본) */}
              {badge > 0 && <UnreadDot />}
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

        {/* 관리자 전용: 관리자 페이지 이동 — 위험한 동작이 아니라 보통 색(ink-soft, 대비 5.85:1).
            빨강 계열은 아래 로그아웃만 쓴다(위험 동작 구분) */}
        {isAdmin && (
          <Link
            href="/admin"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-soft hover:text-ink hover:bg-ink/5 transition-colors mb-0.5"
          >
            <ExternalLink size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />
            관리자 페이지로 이동
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-danger hover:bg-danger-soft transition-colors"
        >
          <LogOut size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
