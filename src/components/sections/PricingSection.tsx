'use client'

/**
 * @컴포넌트: PricingSection
 * @설명: 랜딩 페이지 가격 섹션 — 월간/연간 토글
 */

import { useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'

const features = [
  'Unlimited AI post generation',
  'Direct WordPress publishing',
  'SEO metadata & optimization',
  'Content scheduling',
  'Post management dashboard',
  'Email support',
]

export default function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="relative py-32 px-6">
      {/* Center glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(56,189,248,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-[#38BDF8] text-sm font-semibold tracking-widest uppercase mb-4">
            Pricing
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Simple, honest pricing.
          </h2>
          <p className="text-[#94A3B8] text-lg max-w-xl mx-auto">
            One plan. Everything included. Cancel anytime.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm transition-colors ${!annual ? 'text-white font-medium' : 'text-[#94A3B8]'}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative w-12 h-6 rounded-full transition-colors"
            style={{ backgroundColor: annual ? '#38BDF8' : '#1E293B' }}
            aria-label="Toggle annual billing"
          >
            <span
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: annual ? 'translateX(28px)' : 'translateX(4px)' }}
            />
          </button>
          <span className={`text-sm transition-colors ${annual ? 'text-white font-medium' : 'text-[#94A3B8]'}`}>
            Annual{' '}
            <span className="text-emerald-400 text-xs font-medium">Save ~8%</span>
          </span>
        </div>

        {/* Pricing card */}
        <div className="max-w-sm mx-auto">
          <div className="relative border border-[#38BDF8]/25 bg-[#111A2E] rounded-2xl p-8 overflow-hidden">
            {/* Corner glow */}
            <div
              className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.12]"
              style={{ background: 'radial-gradient(circle, #38BDF8, transparent)' }}
            />

            <div className="relative z-10">
              <p className="text-[#94A3B8] text-sm mb-2">GeniePost</p>

              {/* Price */}
              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl font-bold text-white">
                  {annual ? '$99' : '$9'}
                </span>
                <span className="text-[#94A3B8] text-base mb-2">
                  {annual ? '/year' : '/month'}
                </span>
              </div>
              <p className="text-xs text-[#475569] mb-7">
                {annual ? '~$8.25/month, billed annually' : 'Billed monthly'}
              </p>

              {/* CTA */}
              <Link
                href="/auth/register"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold py-3.5 rounded-xl text-sm hover:bg-[#0ea5e9] transition-all duration-200 hover:-translate-y-0.5 mb-7"
              >
                Get started
                <ArrowRight size={15} />
              </Link>

              {/* Features */}
              <ul className="flex flex-col gap-3">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-[#94A3B8]">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Check size={10} className="text-emerald-400" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-center text-xs text-[#475569] mt-4">
            No credit card required to sign up.
          </p>
        </div>
      </div>
    </section>
  )
}
