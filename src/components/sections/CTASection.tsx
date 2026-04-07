/**
 * @컴포넌트: CTASection
 * @설명: 하단 CTA 섹션 — DB 콘텐츠 우선, 없으면 기본값 사용
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

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

const defaults: Required<CtaContent> = {
  eyebrow: 'Get started today',
  headline: 'Find the right tool for your work.',
  subtext:
    'Explore our products, pick what fits, and get instant access. Built by developers who care about quality.',
  btn1_text: 'Browse products',
  btn1_href: '#product',
  btn2_text: 'Create free account →',
  btn2_href: '/auth/register',
  footnote: 'No credit card required · Instant activation',
}

export default function CTASection({ content }: Props) {
  const c: Required<CtaContent> = {
    ...defaults,
    ...Object.fromEntries(
      Object.entries(content ?? {}).filter(([, v]) => v != null && v !== '')
    ),
  }

  return (
    <section className="py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="relative border border-[#1E293B] bg-[#111A2E] rounded-3xl px-8 py-20 text-center overflow-hidden">
          {/* Glow */}
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(56,189,248,0.1) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10">
            <p className="text-[#38BDF8] text-sm font-semibold tracking-widest uppercase mb-4">
              {c.eyebrow}
            </p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
              {c.headline}
            </h2>
            <p className="text-[#94A3B8] text-lg mb-10 max-w-xl mx-auto">
              {c.subtext}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={c.btn1_href ?? '#'}
                className="inline-flex items-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold px-8 py-4 rounded-xl hover:bg-[#0ea5e9] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(56,189,248,0.35)]"
              >
                {c.btn1_text}
                <ArrowRight size={16} />
              </Link>
              <Link
                href={c.btn2_href ?? '#'}
                className="text-sm text-[#94A3B8] hover:text-white transition-colors"
              >
                {c.btn2_text}
              </Link>
            </div>

            {c.footnote && (
              <p className="mt-6 text-xs text-[#475569]">{c.footnote}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
