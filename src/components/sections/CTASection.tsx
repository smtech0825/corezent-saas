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
  eyebrow: '지금 시작하세요',
  headline: '내게 맞는 도구를 찾아보세요',
  subtext:
    '제품을 둘러보고, 필요한 것을 골라, 즉시 사용하세요. 품질을 중시하는 개발자들이 직접 만들었습니다.',
  btn1_text: '제품 둘러보기',
  btn1_href: '#product',
  btn2_text: '무료 계정 만들기',
  btn2_href: '/auth/register',
  footnote: '신용카드 불필요 · 즉시 활성화',
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
