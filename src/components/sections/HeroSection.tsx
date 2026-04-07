/**
 * @컴포넌트: HeroSection
 * @설명: 랜딩 페이지 히어로 섹션 — DB 콘텐츠 우선, 없으면 기본값 사용
 */

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export interface HeroContent {
  badge?: string | null
  headline1?: string | null
  headline2?: string | null
  subtext?: string | null
  cta1_text?: string | null
  cta1_href?: string | null
  cta2_text?: string | null
  cta2_href?: string | null
}

interface Props {
  content?: HeroContent
}

const defaults: Required<HeroContent> = {
  badge: 'Software built to make your work easier',
  headline1: 'Powerful Software,',
  headline2: 'Crafted with Care.',
  subtext:
    'CoreZent creates and sells thoughtfully-built software — from AI automation tools to productivity apps. Simple pricing, instant activation, and dedicated support.',
  cta1_text: 'Browse products',
  cta1_href: '#product',
  cta2_text: 'Create free account',
  cta2_href: '/auth/register',
}

export default function HeroSection({ content }: Props) {
  const c: Required<HeroContent> = {
    ...defaults,
    ...Object.fromEntries(
      Object.entries(content ?? {}).filter(([, v]) => v != null && v !== '')
    ),
  }

  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-36 pb-24 overflow-hidden"
    >
      {/* The Glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% -5%, rgba(56,189,248,0.18) 0%, transparent 65%)',
        }}
      />

      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(#38BDF8 1px, transparent 1px), linear-gradient(90deg, #38BDF8 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      {/* Badge */}
      <div className="relative z-10 inline-flex items-center gap-2 border border-[#38BDF8]/25 bg-[#38BDF8]/5 rounded-full px-4 py-1.5 text-xs text-[#38BDF8] mb-8 font-medium backdrop-blur-sm">
        <Sparkles size={12} />
        {c.badge}
        <ArrowRight size={12} />
      </div>

      {/* Headline */}
      <h1 className="relative z-10 max-w-5xl font-bold text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] text-white leading-[1.05] tracking-tight mb-6">
        {c.headline1}{' '}
        <br className="hidden sm:block" />
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(135deg, #38BDF8 0%, #818cf8 100%)',
          }}
        >
          {c.headline2}
        </span>
      </h1>

      {/* Subtext */}
      <p className="relative z-10 max-w-2xl text-lg sm:text-xl text-[#94A3B8] leading-relaxed mb-10">
        {c.subtext}
      </p>

      {/* CTA Buttons */}
      <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto max-w-xs sm:max-w-none mb-16">
        <Link
          href={c.cta1_href ?? '#'}
          className="inline-flex items-center justify-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold px-8 py-4 rounded-xl text-base hover:bg-[#0ea5e9] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(56,189,248,0.4)]"
        >
          {c.cta1_text}
          <ArrowRight size={16} />
        </Link>
        <Link
          href={c.cta2_href ?? '#'}
          className="inline-flex items-center justify-center gap-2 border border-[#1E293B] text-[#F1F5F9] font-medium px-8 py-4 rounded-xl text-base hover:border-[#38BDF8]/40 hover:bg-[#38BDF8]/5 transition-all duration-200"
        >
          {c.cta2_text}
        </Link>
      </div>

      {/* Value pills */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
        {[
          'Built by developers',
          'Instant license activation',
          'Simple pricing',
          'Dedicated support',
        ].map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-2 border border-[#1E293B] bg-[#111A2E]/80 rounded-full px-4 py-1.5 text-sm text-[#94A3B8] backdrop-blur-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            {item}
          </span>
        ))}
      </div>
    </section>
  )
}
