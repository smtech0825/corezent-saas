'use client'

/**
 * @컴포넌트: Navbar
 * @설명: 상단 고정 네비게이션 바
 *        - 공지 배너
 *        - 로고, 메뉴 링크 (i18n)
 *        - 비로그인: Log in / Get started
 *        - 로그인 시: 아바타 드롭다운 (My Page, Settings, Log out)
 *        - 언어 선택 드롭다운 (실제 작동)
 *        - 모바일 햄버거 메뉴
 */

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X, Zap, ChevronDown, User, LogOut, LayoutDashboard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n'
import LanguageSelector from '@/components/LanguageSelector'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function Navbar() {
  const router = useRouter()
  const { t } = useLanguage()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const userRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // 네비게이션 링크 (번역 적용)
  const navLinks = [
    { label: t.nav.about, href: '#about' },
    { label: t.nav.product, href: '#product' },
    { label: t.nav.pricing, href: '/pricing' },
    { label: t.nav.changelog, href: '#changelog' },
    { label: t.nav.manual, href: '/manuals' },
    { label: t.nav.contact, href: '#contact' },
  ]

  // 로그인 상태 감지
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      if (data.user) {
        supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            setAvatarUrl(profile?.avatar_url ?? null)
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

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setUserOpen(false)
    router.push('/')
    router.refresh()
  }

  const initials = user
    ? (user.user_metadata?.name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()
    : 'U'

  return (
    <header className="fixed top-0 inset-x-0 z-50 flex flex-col">
      {/* 공지 배너 */}
      <div className="w-full bg-[#0B1120] border-b border-[#1E293B] py-2 text-center text-xs text-[#38BDF8] px-4">
        <span className="inline-flex items-center justify-center gap-2 flex-wrap">
          <Zap size={12} className="fill-[#38BDF8] shrink-0" />
          <span className="hidden sm:inline">
            Introducing GeniePost — AI-powered WordPress posting, starting at $9/month.
          </span>
          <span className="sm:hidden">GeniePost is here — AI WordPress posting from $9/mo.</span>
          <Link
            href="#product"
            className="underline underline-offset-2 hover:text-white transition-colors whitespace-nowrap"
          >
            Learn more →
          </Link>
        </span>
      </div>

      {/* 네비게이션 바 */}
      <nav className="backdrop-blur-md bg-[#0B1120]/80 border-b border-[#1E293B]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* 로고 */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl text-white tracking-tight shrink-0"
          >
            <span className="w-7 h-7 rounded-lg bg-[#38BDF8] flex items-center justify-center text-[#0B1120] text-sm font-black">
              C
            </span>
            CoreZent
          </Link>

          {/* 데스크톱 메뉴 */}
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-[#94A3B8] hover:text-white transition-colors whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* 우측 영역 */}
          <div className="flex items-center gap-2">
            {user ? (
              /* 로그인 상태: 아바타 드롭다운 */
              <div ref={userRef} className="relative hidden lg:block">
                <button
                  onClick={() => setUserOpen(!userOpen)}
                  className="flex items-center gap-2 border border-[#1E293B] hover:border-[#38BDF8]/40 rounded-lg px-2 py-1.5 transition-colors"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-[#38BDF8]/20 border border-[#38BDF8]/30 flex items-center justify-center text-xs font-bold text-[#38BDF8]">
                      {initials}
                    </span>
                  )}
                  <ChevronDown
                    size={13}
                    className={`text-[#94A3B8] transition-transform duration-200 ${
                      userOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {userOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-[#1E293B] bg-[#111A2E] shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-[#1E293B]">
                      <p className="text-xs text-[#94A3B8] truncate">{user.email}</p>
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50 transition-colors"
                    >
                      <LayoutDashboard size={14} />
                      {t.nav.myPage}
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50 transition-colors"
                    >
                      <User size={14} />
                      {t.nav.settings}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors border-t border-[#1E293B]"
                    >
                      <LogOut size={14} />
                      {t.nav.logout}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* 비로그인 상태 */
              <>
                <Link
                  href="/auth/login"
                  className="hidden lg:block text-sm text-[#94A3B8] hover:text-white transition-colors px-2"
                >
                  {t.nav.login}
                </Link>
                <Link
                  href="/auth/register"
                  className="hidden lg:inline-flex items-center gap-1.5 bg-[#38BDF8] text-[#0B1120] text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#0ea5e9] transition-colors"
                >
                  {t.nav.getStarted}
                </Link>
              </>
            )}

            {/* 언어 선택 드롭다운 */}
            <div className="hidden lg:block">
              <LanguageSelector align="right" />
            </div>

            {/* 모바일 햄버거 */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden text-[#94A3B8] hover:text-white p-1"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-[#1E293B] bg-[#0B1120] px-6 py-4 flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm text-[#94A3B8] hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 flex flex-col gap-2 border-t border-[#1E293B]">
              {user ? (
                <>
                  <p className="text-xs text-[#475569] px-1">{user.email}</p>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="text-sm text-[#94A3B8] hover:text-white"
                  >
                    {t.nav.myPage}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-left text-sm text-red-400 hover:text-red-300"
                  >
                    {t.nav.logout}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="text-sm text-[#94A3B8] hover:text-white"
                  >
                    {t.nav.login}
                  </Link>
                  <Link
                    href="/auth/register"
                    className="inline-flex justify-center bg-[#38BDF8] text-[#0B1120] text-sm font-semibold px-4 py-2 rounded-lg"
                  >
                    {t.nav.getStarted}
                  </Link>
                </>
              )}
              {/* 모바일 언어 선택 */}
              <div className="pt-1">
                <LanguageSelector align="left" />
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
