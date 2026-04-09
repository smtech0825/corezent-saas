'use client'

/**
 * @컴포넌트: CountrySelect
 * @설명: 국가 코드 + 국기 이모지 포함 검색 가능 드롭다운 (공통 컴포넌트)
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { COUNTRIES, getFlag } from '@/lib/countries'

interface Props {
  value: string
  onChange: (code: string) => void
  required?: boolean
  placeholder?: string
}

export default function CountrySelect({ value, onChange, required, placeholder = 'Select country' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = COUNTRIES.find((c) => c.code === value) ?? null

  const filtered = query.trim()
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.code.toLowerCase().includes(query.toLowerCase())
      )
    : COUNTRIES

  const handleOpen = useCallback(() => {
    setOpen(true)
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [])

  const handleSelect = useCallback((code: string) => {
    onChange(code)
    setOpen(false)
    setQuery('')
  }, [onChange])

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }, [onChange])

  // 외부 클릭 시 닫기
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    if (open) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const inputCls = 'w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#38BDF8] transition-colors'

  return (
    <div ref={containerRef} className="relative">
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={open ? () => { setOpen(false); setQuery('') } : handleOpen}
        className={`${inputCls} flex items-center justify-between gap-2 cursor-pointer text-left`}
      >
        {selected ? (
          <span className="flex items-center gap-2.5">
            <span className="text-base leading-none">{getFlag(selected.code)}</span>
            <span className="text-white">{selected.name}</span>
            <span className="text-xs text-[#475569] font-mono">{selected.code}</span>
          </span>
        ) : (
          <span className="text-[#475569]">{placeholder}</span>
        )}
        <span className="flex items-center gap-1 shrink-0">
          {selected && (
            <span onClick={handleClear} className="text-[#475569] hover:text-[#94A3B8] p-0.5 rounded">
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-[#475569] transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* 숨겨진 select — form 제출 / required 처리 */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        <option value="">—</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#111A2E] border border-[#1E293B] rounded-xl shadow-xl overflow-hidden">
          {/* 검색 입력 */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1E293B]">
            <Search size={13} className="text-[#475569] shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-[#475569] focus:outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-[#475569] hover:text-[#94A3B8]">
                <X size={12} />
              </button>
            )}
          </div>

          {/* 국가 목록 */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-[#475569] text-center">No results</li>
            ) : (
              filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => handleSelect(c.code)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-[#1E293B] transition-colors ${
                      c.code === value ? 'text-[#38BDF8]' : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <span className="text-base leading-none w-6 shrink-0">{getFlag(c.code)}</span>
                    <span className="flex-1 text-left">{c.name}</span>
                    <span className="text-xs text-[#475569] font-mono">{c.code}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
