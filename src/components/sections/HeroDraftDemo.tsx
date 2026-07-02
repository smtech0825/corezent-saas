'use client'

/**
 * @컴포넌트: HeroDraftDemo
 * @설명: 히어로 하단 "초안이 저절로 작성되는" 타이핑 데모.
 *        원문을 HTML에 그대로 두고(무JS·SEO 대응) 마운트 후 지웠다가 다시 타이핑.
 *        prefers-reduced-motion 시 정적 표시.
 */

import { useEffect, useRef } from 'react'

const DEMO_LINES = [
  '제목: 2026년 하반기 청사 에너지 절감 추진계획(안)',
  '1. 추진 배경: 정부 에너지 이용 합리화 지침에 따라 하반기 청사 운영 전반의 절감 과제를 발굴하고자 함.',
  '2. 추진 과제: 가. 냉난방 운영 기준 조정  나. 노후 조명 교체  다. 대기전력 관리 강화',
]

export default function HeroDraftDemo() {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sheet = sheetRef.current
    if (reduce || !sheet) return

    const lines = Array.from(sheet.querySelectorAll<HTMLSpanElement>('[data-type]'))
    const caret = sheet.querySelector<HTMLSpanElement>('[data-caret]')
    if (lines.length === 0) return

    const texts = lines.map((el) => el.textContent ?? '')
    lines.forEach((el) => { el.textContent = '' })

    let li = 0
    let ci = 0
    let timer: ReturnType<typeof setTimeout>

    /** 한 틱에 1~2자씩 타이핑 — 사람이 아닌 '생성' 속도감 */
    function type() {
      if (li >= lines.length) return
      const t = texts[li]
      ci += 1 + Math.floor(Math.random() * 2)
      lines[li].textContent = t.slice(0, ci)
      if (caret) lines[li].appendChild(caret)
      if (ci >= t.length) {
        li += 1
        ci = 0
        timer = setTimeout(type, 280)
      } else {
        timer = setTimeout(type, 22)
      }
    }
    timer = setTimeout(type, 600)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="w-full max-w-2xl">
      {/* 파일 탭 */}
      <span className="inline-flex items-center gap-2 rounded-t-md border border-b-0 border-rule bg-paper-shade px-3.5 py-1.5 font-mono text-xs text-ink-soft">
        <span className="w-2 h-2 rounded-full bg-seal/75 shrink-0" />
        2026_하반기_추진계획(안).hwp
      </span>

      {/* 문서 시트 */}
      <div
        ref={sheetRef}
        className="rounded-b-md rounded-tr-md border border-rule bg-paper-raised px-6 py-5 text-left text-sm leading-8 text-ink min-h-40 shadow-[0_1px_2px_rgba(35,39,46,0.05)]"
        aria-label="초안 자동 작성 미리보기"
      >
        <span data-type className="block font-semibold break-keep">{DEMO_LINES[0]}</span>
        <span data-type className="block break-keep">{DEMO_LINES[1]}</span>
        <span data-type className="block break-keep">{DEMO_LINES[2]}</span>
        <span
          data-caret
          aria-hidden="true"
          className="inline-block w-0.5 h-[1.05em] bg-ink align-[-0.18em] ml-px [animation:caret-blink_1s_steps(1)_infinite]"
        />
      </div>

      <p className="mt-2.5 text-left font-sans text-xs text-ink-faint">
        제목과 개요만 입력하면, 지니워크가 위와 같은 초안을 작성합니다.
      </p>
    </div>
  )
}
