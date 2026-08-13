/**
 * @컴포넌트: CTASection
 * @설명: 하단 CTA — 공문 발신명의 + 직인(스탬프) 스타일. DB 콘텐츠 우선, 없으면 기본값.
 */

import Button from '@/components/ui/Button'
import Container from '@/components/ui/Container'
import StampSeal from '@/components/sections/StampSeal'
import { CTA_DEFAULTS } from '@/lib/front-defaults'

export interface CtaContent {
  eyebrow?: string | null
  headline?: string | null
  subtext?: string | null
  btn1_text?: string | null
  btn1_href?: string | null
  btn2_text?: string | null
  btn2_href?: string | null
  footnote?: string | null
}

interface Props {
  content?: CtaContent
}

// 예비값 단일 출처 — lib/front-defaults.ts (관리자 편집기 초기값과 반드시 동일해야 함)
const defaults: Required<CtaContent> = CTA_DEFAULTS

export default function CTASection({ content }: Props) {
  const c: Required<CtaContent> = {
    ...defaults,
    ...Object.fromEntries(
      Object.entries(content ?? {}).filter(([, v]) => v != null && v !== '')
    ),
  }

  return (
    <section className="py-20 sm:py-28 border-t border-rule">
      <Container width="content">
        <div className="relative text-center">
          <p className="font-sans text-sm font-semibold tracking-[0.2em] text-pen mb-4">
            {c.eyebrow}
          </p>
          <h2 className="font-serif font-black text-3xl sm:text-5xl text-ink leading-tight break-keep mb-5">
            {c.headline}
          </h2>
          <p className="text-ink-soft text-base sm:text-lg max-w-xl mx-auto break-keep mb-9">
            {c.subtext}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button href={c.btn1_href ?? '#'} size="lg">{c.btn1_text}</Button>
            <Button href={c.btn2_href ?? '#'} variant="ghost" size="md">{c.btn2_text}</Button>
          </div>

          {c.footnote && <p className="mt-6 text-xs text-ink-faint">{c.footnote}</p>}

          {/* 발신명의 + 직인 */}
          <div className="mt-16 pt-10 border-t border-rule flex items-center justify-center gap-3">
            <span className="font-serif font-black text-xl sm:text-2xl tracking-[0.3em] [text-indent:0.3em] text-ink">
              코어젠트
            </span>
            <StampSeal />
          </div>
        </div>
      </Container>
    </section>
  )
}
