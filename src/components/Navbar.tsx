'use client'

/**
 * @컴포넌트: Navbar
 * @설명: 상단 고정 네비게이션 바
 *        - 공지 배너
 *        - 로고, 메뉴 링크 (i18n)
 *        - 비로그인: Log in / Get started
 *        - 로그인 시: 아바타 드롭다운 (My Page, Settings, Log out)
 *        - 모바일 햄버거 메뉴
 *        - 모든 이동은 a 태그 대신 button + router.push 사용
 *          (브라우저 좌측 하단 URL 미리보기 표시 방지)
 */

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X, Zap, ChevronDown, User, LogOut, LayoutDashboard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import type { User as SupabaseUser } from '@supabase/supabase-js'

// ── 컬러 해싱 — 유저 이름 기반 라이트 파스텔 배경 (페이퍼 테마) ──────────────
const AVATAR_PALETTES = [
  { bg: 'bg-indigo-100',  border: 'border-indigo-300'  },
  { bg: 'bg-emerald-100', border: 'border-emerald-300' },
  { bg: 'bg-amber-100',   border: 'border-amber-300'   },
  { bg: 'bg-rose-100',    border: 'border-rose-300'    },
  { bg: 'bg-violet-100',  border: 'border-violet-300'  },
  { bg: 'bg-cyan-100',    border: 'border-cyan-300'    },
  { bg: 'bg-teal-100',    border: 'border-teal-300'    },
  { bg: 'bg-sky-100',     border: 'border-sky-300'     },
]

function hashColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length]
}

export default function Navbar() {
  const router = useRouter()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)

  // 공지 배너 데이터 (DB에서 로드)
  const [banner, setBanner] = useState({
    text: 'GenieWork 출시 — 공무원 공문 작성 데스크톱 앱, 지금 만나보세요.',
    text_mobile: 'GenieWork 출시 — 공무원 공문 작성 데스크톱 앱',
    link_text: '자세히 보기 →',
    link_url: '#product',
    visible: 'true',
  })

  const userRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // 네비게이션 링크
  const navLinks: { label: string; href: string; external?: boolean }[] = [
    { label: '회사소개', href: '/about' },
    { label: '제품', href: '/product' },
    { label: '요금', href: '/pricing' },
    { label: '업데이트 내역', href: '/changelog' },
    { label: '매뉴얼', href: '/docs' },
    { label: '블로그', href: '/blog' },
    { label: '사용 설명서', href: 'https://sites.google.com/view/corezent', external: true },
    { label: 'FAQ', href: '/faq' },
    { label: '문의하기', href: '/contact' },
  ]

  // 배너 데이터 로드
  useEffect(() => {
    supabase
      .from('front_content')
      .select('key, value')
      .like('key', 'banner_%')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map = Object.fromEntries(data.map((r) => [r.key, r.value]))
          setBanner((prev) => ({
            text:        map['banner_text']        ?? prev.text,
            text_mobile: map['banner_text_mobile'] ?? prev.text_mobile,
            link_text:   map['banner_link_text']   ?? prev.link_text,
            link_url:    map['banner_link_url']    ?? prev.link_url,
            visible:     map['banner_visible']     ?? prev.visible,
          }))
        }
      })
  }, [supabase])

  // 로그인 상태 감지
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      if (data.user) {
        supabase
          .from('profiles')
          .select('avatar_url, name')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            setAvatarUrl(profile?.avatar_url ?? null)
            setUserName(profile?.name ?? null)
          })
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [supabase])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /**
   * @함수명: go
   * @설명: 내비게이션 이동 — a 태그 대신 사용해 브라우저 상태바 URL 미리보기를 숨깁니다.
   * @매개변수: href - 이동할 경로, external - 외부 링크 여부(새 탭)
   */
  function go(href: string, external?: boolean) {
    if (external) window.open(href, '_blank', 'noopener,noreferrer')
    else router.push(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setUserOpen(false)
    router.push('/')
    router.refresh()
  }

  // 유저 이름 → 이메일 @앞 → 'U' 순서로 이니셜 추출
  const displayName = userName ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? ''
  const initials = displayName ? displayName[0].toUpperCase() : 'U'
  const avatarColor = hashColor(displayName || user?.email || 'user')

  return (
    <header className="sticky top-0 inset-x-0 z-50 flex flex-col">
      {/* 공지 배너 — Admin에서 관리 */}
      {banner.visible === 'true' && (
        <div className="w-full bg-paper-shade border-b border-rule py-2 text-center text-xs text-ink-soft px-4">
          <span className="inline-flex items-center justify-center gap-2 flex-wrap">
            <Zap size={12} className="fill-pen text-pen shrink-0" />
            <span className="hidden sm:inline">{banner.text}</span>
            <span className="sm:hidden">{banner.text_mobile}</span>
            {banner.link_text && banner.link_url && (
              <button
                type="button"
                onClick={() => go(banner.link_url)}
                className="text-pen underline underline-offset-2 hover:text-pen-dark transition-colors whitespace-nowrap cursor-pointer"
              >
                {banner.link_text}
              </button>
            )}
          </span>
        </div>
      )}

      {/* 네비게이션 바 — 공문 두문의 굵은 밑줄
       * 스크롤 고정(sticky) 요소라 backdrop-filter는 매 프레임 뒤 배경을 재블러해
       * 연속 스크롤 시 GPU 스톨(화면 프리징)을 유발 → 불투명 배경으로 대체(성능) */}
      <nav className="bg-paper border-b-2 border-ink">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* 로고 */}
          <button
            type="button"
            onClick={() => go('/')}
            className="flex items-center gap-2 font-bold text-xl text-ink tracking-tight shrink-0 cursor-pointer"
          >
            <span className="w-7 h-7 rounded border-[1.5px] border-seal flex items-center justify-center text-seal text-sm font-black -rotate-3">
              C
            </span>
            CoreZent
          </button>

          {/* 데스크톱 메뉴 */}
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => go(link.href, link.external)}
                className="text-sm text-ink-soft hover:text-ink transition-colors whitespace-nowrap cursor-pointer"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* 우측 영역 */}
          <div className="flex items-center gap-2">
            {user ? (
              /* 로그인 상태: 아바타 드롭다운 */
              <div ref={userRef} className="relative hidden lg:block">
                <button
                  onClick={() => setUserOpen(!userOpen)}
                  className="flex items-center gap-2.5 border border-rule hover:border-pen/50 rounded-md px-4 py-2 transition-colors min-w-[88px] justify-center"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-semibold text-ink ${avatarColor.bg} ${avatarColor.border}`}>
                      {initials}
                    </span>
                  )}
                  <ChevronDown
                    size={13}
                    className={`text-ink-faint transition-transform duration-200 ${
                      userOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {userOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 rounded-md border border-rule bg-paper-raised shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-rule">
                      <p className="text-xs text-ink-faint truncate">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setUserOpen(false); go('/dashboard') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft hover:text-ink hover:bg-paper-shade transition-colors cursor-pointer"
                    >
                      <LayoutDashboard size={14} />
                      대시보드
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUserOpen(false); go('/dashboard/settings') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft hover:text-ink hover:bg-paper-shade transition-colors cursor-pointer"
                    >
                      <User size={14} />
                      설정
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-seal hover:bg-seal/5 transition-colors border-t border-rule"
                    >
                      <LogOut size={14} />
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* 비로그인 상태 */
              <>
                <button
                  type="button"
                  onClick={() => go('/auth/login')}
                  className="hidden lg:block text-sm text-ink-soft hover:text-ink transition-colors px-2 cursor-pointer"
                >
                  로그인
                </button>
                <button
                  type="button"
                  onClick={() => go('/auth/register')}
                  className="hidden lg:inline-flex items-center gap-1.5 bg-pen text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-pen-dark transition-colors cursor-pointer"
                >
                  시작하기
                </button>
              </>
            )}



            {/* 모바일 햄버거 */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden text-ink-soft hover:text-ink p-1"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-rule bg-paper px-6 py-4 flex flex-col gap-4">
            {navLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => { setMobileOpen(false); go(link.href, link.external) }}
                className="text-left text-sm text-ink-soft hover:text-ink transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-2 flex flex-col gap-2 border-t border-rule">
              {user ? (
                <>
                  <p className="text-xs text-ink-faint px-1">{user.email}</p>
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); go('/dashboard') }}
                    className="text-left text-sm text-ink-soft hover:text-ink cursor-pointer"
                  >
                    대시보드
                  </button>
                  <button
                    onClick={handleLogout}
                    className="text-left text-sm text-seal"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); go('/auth/login') }}
                    className="text-left text-sm text-ink-soft hover:text-ink cursor-pointer"
                  >
                    로그인
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMobileOpen(false); go('/auth/register') }}
                    className="inline-flex justify-center bg-pen text-white text-sm font-semibold px-4 py-2 rounded-md cursor-pointer"
                  >
                    시작하기
                  </button>
                </>
              )}

            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
