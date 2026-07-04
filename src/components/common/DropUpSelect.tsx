'use client'

/**
 * @컴포넌트: DropUpSelect
 * @설명: 옵션 축 값이 많을 때(3개 이상) 세그먼트 버튼을 대체하는 '위로 열리는' 커스텀 선택기.
 *        하단 고정 구매 바에서 값이 여러 개면 세그먼트가 본문 폭을 넘치므로 폭이 좁은 드롭업으로 접는다.
 *        네이티브 <select> 미사용 — 페이퍼 톤 디자인 시스템에 맞춘 트리거 + 리스트박스.
 *        접근성: 트리거 aria-expanded/aria-haspopup, 메뉴 role="listbox"·항목 role="option",
 *        키보드 ↑↓·Home/End·Enter·Esc 지원. 외부 클릭·ESC로 닫힘. 메뉴는 트리거 위쪽(bottom-full)으로 열린다.
 */

import { useState, useRef, useEffect, useCallback, useId, type ReactNode, type KeyboardEvent } from 'react'
import { ChevronUp, Check } from 'lucide-react'

/** 드롭업 옵션 하나 */
export interface DropUpOption {
  value: string
  /** 트리거·목록에 표시되는 짧은 값 라벨(예: "10PC용") */
  label: string
  /** 목록에서 값 오른쪽에 표시되는 보조 라벨(예: "₩690,000/년") */
  priceLabel?: ReactNode
  disabled?: boolean
}

interface Props {
  /** 컨트롤 상단 라벨(세그먼트와 동일 규격). 없으면 렌더하지 않음 */
  label?: string
  /** 현재 선택 값 */
  value: string
  /** 선택 가능한 옵션 목록 */
  options: DropUpOption[]
  /** 선택 변경 콜백 */
  onChange: (value: string) => void
  /** 접근성용 그룹 라벨(보이는 label이 없을 때) */
  ariaLabel?: string
  /** 트리거 최소 폭 클래스(기본 min-w-[96px]) */
  triggerMinWidthClass?: string
}

/**
 * @함수명: DropUpSelect
 * @설명: 옵션 목록을 위로 열리는 리스트박스로 렌더하고, 선택 시 값을 변경합니다.
 * @매개변수: label - 상단 라벨, value - 현재 값, options - 옵션 목록, onChange - 변경 콜백
 * @반환값: 드롭업 선택기 노드
 */
export default function DropUpSelect({
  label, value, options, onChange, ariaLabel, triggerMinWidthClass = 'min-w-[96px]',
}: Props) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const baseId = useId()

  const selected = options.find((o) => o.value === value) ?? null
  // 활성(비disabled) 옵션 인덱스 목록 — 키보드 이동은 이들 사이에서만
  const enabledIndexes = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
  const optId = (i: number) => `${baseId}-opt-${i}`

  const openMenu = useCallback(() => {
    const selIdx = options.findIndex((o) => o.value === value && !o.disabled)
    setHighlight(selIdx >= 0 ? selIdx : (enabledIndexes[0] ?? 0))
    setOpen(true)
  }, [options, value, enabledIndexes])

  const closeMenu = useCallback((refocus = false) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  const choose = useCallback((i: number) => {
    const o = options[i]
    if (!o || o.disabled) return
    onChange(o.value)
    closeMenu(true)
  }, [options, onChange, closeMenu])

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  // 하이라이트를 활성 옵션 사이에서 순환 이동
  const move = useCallback((dir: 1 | -1) => {
    if (enabledIndexes.length === 0) return
    const pos = enabledIndexes.indexOf(highlight)
    const next = enabledIndexes[(pos + dir + enabledIndexes.length) % enabledIndexes.length]
    setHighlight(next)
  }, [enabledIndexes, highlight])

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); move(-1); break
      case 'ArrowDown': e.preventDefault(); move(1); break
      case 'Home': e.preventDefault(); setHighlight(enabledIndexes[0] ?? 0); break
      case 'End': e.preventDefault(); setHighlight(enabledIndexes[enabledIndexes.length - 1] ?? 0); break
      case 'Enter': case ' ': e.preventDefault(); choose(highlight); break
      case 'Escape': e.preventDefault(); closeMenu(true); break
      case 'Tab': closeMenu(); break
    }
  }, [open, move, choose, highlight, enabledIndexes, openMenu, closeMenu])

  return (
    <div ref={containerRef} className="min-w-0">
      {label && <span className="block text-[11px] text-ink-faint mb-1 leading-none">{label}</span>}
      <div className="relative">
        {/* 트리거 — 세그먼트 컨트롤과 동일 높이(34px)로 하단선 정렬 유지 */}
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel ?? label}
          aria-activedescendant={open ? optId(highlight) : undefined}
          onClick={() => (open ? closeMenu() : openMenu())}
          onKeyDown={onKeyDown}
          className={`inline-flex items-center justify-between gap-1.5 ${triggerMinWidthClass} max-w-full border border-rule bg-paper rounded-md px-3 py-2 text-xs font-medium text-ink whitespace-nowrap cursor-pointer hover:border-ink-faint transition-colors`}
        >
          <span className="truncate">{selected?.label ?? '선택'}</span>
          <ChevronUp size={13} className={`shrink-0 text-ink-faint transition-transform ${open ? '' : 'rotate-180'}`} />
        </button>

        {/* 메뉴 — 트리거 위쪽으로 열림(바보다 위 z-index) */}
        {open && (
          <ul
            role="listbox"
            aria-label={ariaLabel ?? label}
            className="absolute bottom-full left-0 mb-1 z-[70] w-max max-w-[calc(100vw-2rem)] border border-rule bg-paper-raised rounded-md shadow-lg py-1"
          >
            {options.map((o, i) => {
              const isSel = o.value === value
              const isHi = i === highlight
              return (
                <li key={o.value} id={optId(i)} role="option" aria-selected={isSel} aria-disabled={o.disabled || undefined}>
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={o.disabled}
                    onClick={() => choose(i)}
                    onMouseEnter={() => !o.disabled && setHighlight(i)}
                    className={`w-full flex items-center justify-between gap-4 px-3 py-2 text-xs whitespace-nowrap transition-colors ${
                      o.disabled ? 'text-ink-faint/50 cursor-not-allowed' : isHi ? 'bg-paper-shade cursor-pointer' : 'cursor-pointer'
                    }`}
                  >
                    <span className={`flex items-center gap-1.5 ${isSel ? 'text-pen font-semibold' : 'text-ink'}`}>
                      <Check size={13} className={`shrink-0 ${isSel ? 'opacity-100' : 'opacity-0'}`} />
                      {o.label}
                    </span>
                    {o.priceLabel != null && (
                      <span className="text-ink-soft tabular-nums text-right">{o.priceLabel}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
