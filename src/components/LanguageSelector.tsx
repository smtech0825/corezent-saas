'use client'

/**
 * @컴포넌트: LanguageSelector
 * @설명: 재사용 가능한 언어 선택 드롭다운 — Navbar, Dashboard 공통 사용
 */

import { useRef, useState, useEffect } from 'react'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { useLanguage, languages } from '@/lib/i18n'

interface Props {
  /** 드롭다운이 열리는 방향 */
  align?: 'left' | 'right'
}

export default function LanguageSelector({ align = 'right' }: Props) {
  const { lang, setLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const activeLang = languages.find((l) => l.code === lang) ?? languages[0]

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-[#94A3B8] hover:text-white transition-colors border border-[#1E293B] hover:border-[#38BDF8]/40 rounded-lg px-3 py-2"
        aria-label="Select language"
      >
        <Globe size={14} />
        <span>{activeLang.code.toUpperCase()}</span>
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 w-36 rounded-xl border border-[#1E293B] bg-[#111A2E] shadow-xl overflow-hidden z-50 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code)
                setOpen(false)
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                lang === l.code
                  ? 'text-[#38BDF8] bg-[#38BDF8]/5'
                  : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
              }`}
            >
              {l.label}
              {lang === l.code && <Check size={13} className="text-[#38BDF8]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
