'use client'

/**
 * @컴포넌트: StampSeal
 * @설명: 인주(印朱) 직인 — 화면에 들어오면 쾅 찍히는 스탬프 애니메이션.
 *        IntersectionObserver 미지원/모션 최소화 환경에서는 즉시 찍힌 상태로 표시.
 */

import { useEffect, useRef, useState } from 'react'

interface StampSealProps {
  /** 도장 안에 들어갈 두 줄 텍스트 (기본: 지니워크 / 도입인) */
  line1?: string
  line2?: string
  className?: string
}

export default function StampSeal({ line1 = '지니워크', line2 = '도입인', className = '' }: StampSealProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [stamped, setStamped] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      setStamped(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          setStamped(true)
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <span
      ref={ref}
      className={`inline-block w-20 h-20 sm:w-24 sm:h-24 mix-blend-multiply pointer-events-none select-none ${stamped ? 'animate-stamp' : 'opacity-0'} ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#C93A2C" strokeWidth="4.5" />
        <text
          x="50" y="44" textAnchor="middle" fill="#C93A2C"
          fontFamily="var(--font-serif-kr), 'Noto Serif KR', serif" fontWeight="900" fontSize="20" letterSpacing="1"
        >
          {line1}
        </text>
        <text
          x="50" y="70" textAnchor="middle" fill="#C93A2C"
          fontFamily="var(--font-serif-kr), 'Noto Serif KR', serif" fontWeight="900" fontSize="20" letterSpacing="5"
        >
          {line2}
        </text>
      </svg>
    </span>
  )
}
