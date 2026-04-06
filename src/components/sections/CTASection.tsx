/**
 * @컴포넌트: CTASection
 * @설명: 하단 CTA 섹션 — CoreZent 소프트웨어 탐색 유도
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function CTASection() {
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
              Get started today
            </p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
              Find the right tool for your work.
            </h2>
            <p className="text-[#94A3B8] text-lg mb-10 max-w-xl mx-auto">
              Explore our products, pick what fits, and get instant access. Built
              by developers who care about quality.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="#product"
                className="inline-flex items-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold px-8 py-4 rounded-xl hover:bg-[#0ea5e9] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(56,189,248,0.35)]"
              >
                Browse products
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/auth/register"
                className="text-sm text-[#94A3B8] hover:text-white transition-colors"
              >
                Create free account →
              </Link>
            </div>

            <p className="mt-6 text-xs text-[#475569]">
              No credit card required · Instant activation
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
