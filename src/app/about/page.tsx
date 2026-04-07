/**
 * @파일: app/about/page.tsx
 * @설명: CoreZent About 페이지 — 브랜드 스토리, 철학, 생태계
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Monitor, Puzzle, Globe, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About CoreZent — Engineering Precision, Empowering Workflow',
  description:
    'CoreZent was born from the technical heritage of SM Tech Co Ltd. Learn about our philosophy, our software ecosystem, and our commitment to digital craftsmanship.',
}

const principles = [
  {
    label: 'Performance First',
    text: 'Optimized architecture that delivers overwhelming speed while minimizing system resource consumption.',
    color: 'text-[#38BDF8]',
  },
  {
    label: 'Intuitive Aesthetics',
    text: 'A refined, "Raycast-style" interface that allows anyone to navigate complex tasks like a pro, without needing a manual.',
    color: 'text-violet-400',
  },
  {
    label: 'Solid Reliability',
    text: 'Sustainable tools backed by seamless service and rigorous license management.',
    color: 'text-emerald-400',
  },
]

const ecosystem = [
  {
    icon: Monitor,
    label: 'Desktop Apps',
    desc: 'Power-user tools that integrate deeply into the OS for maximum performance.',
    color: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20',
  },
  {
    icon: Puzzle,
    label: 'Chrome Extensions',
    desc: 'Innovations that bridge the gap between web browsing and professional productivity.',
    color: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  },
  {
    icon: Globe,
    label: 'Web & Mobile',
    desc: 'Cloud-based solutions that ensure your tools and data are accessible anytime, anywhere.',
    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0B1120]">
      {/* 헤더 */}
      <div className="border-b border-[#1E293B]">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
            <span className="w-7 h-7 rounded-lg bg-[#38BDF8] flex items-center justify-center text-[#0B1120] text-sm font-black">
              C
            </span>
            CoreZent
          </Link>
          <Link href="/" className="text-sm text-[#94A3B8] hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, #1E293B 0%, #0B1120 100%)',
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
            About CoreZent
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
            Engineering{' '}
            <span className="text-[#38BDF8]">Precision</span>,
            <br />
            Empowering Workflow
          </h1>
          <p className="text-[#94A3B8] text-lg leading-relaxed max-w-2xl mx-auto">
            We don&apos;t just write code — we practice{' '}
            <span className="text-white font-semibold">Digital Craftsmanship</span>.
            Every product bearing the CoreZent name is built to last.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-8">

        {/* 섹션 1 — The Genesis */}
        <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-[#1E293B] flex items-center gap-4">
            <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-sm font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <h2 className="text-base font-semibold text-white">The Genesis: From SM Tech to CoreZent</h2>
          </div>
          <div className="px-7 py-6">
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              CoreZent was born from the technical heritage of{' '}
              <span className="text-white font-medium">SM Tech Co Ltd</span>. We began with a
              fundamental question: &ldquo;What is the essential value software can provide to a user?&rdquo;
            </p>
            <p className="text-sm text-[#94A3B8] leading-relaxed mt-4">
              What started as a collection of small tools designed to maximize business automation
              and efficiency has evolved into a comprehensive{' '}
              <span className="text-white font-medium">Software House</span>. Today, we span the
              entire digital ecosystem — from high-performance desktop applications and Chrome
              extensions to intelligent web services. The name{' '}
              <span className="text-[#38BDF8] font-semibold">CoreZent</span> represents our
              dedication to the &lsquo;Core&rsquo; of technology and our relentless pursuit of its{' '}
              <span className="text-[#38BDF8] font-semibold">Zenith</span>.
            </p>
          </div>
        </div>

        {/* 섹션 2 — Philosophy */}
        <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-[#1E293B] flex items-center gap-4">
            <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-sm font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <h2 className="text-base font-semibold text-white">Our Philosophy: Craftsmanship in Code</h2>
          </div>
          <div className="px-7 py-6">
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-6">
              Every product bearing the CoreZent name is built upon three non-negotiable principles:
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {principles.map((p) => (
                <div key={p.label} className="bg-[#0B1120] rounded-xl p-4">
                  <p className={`text-sm font-semibold mb-2 ${p.color}`}>{p.label}</p>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">{p.text}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed mt-6">
              Our goal is to eliminate the friction between the user and their tools, allowing them
              to focus entirely on their creative output.
            </p>
          </div>
        </div>

        {/* 섹션 3 — Ecosystem */}
        <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-[#1E293B] flex items-center gap-4">
            <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-sm font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <h2 className="text-base font-semibold text-white">The CoreZent Ecosystem: Versatility and Unity</h2>
          </div>
          <div className="px-7 py-6">
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-6">
              While our portfolio is diverse, it is anchored by a unified vision.
            </p>

            {/* 에코시스템 그래픽 */}
            <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0 mb-6">
              {ecosystem.map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${item.color}`}>
                        <Icon size={24} />
                      </div>
                      <span className="text-xs font-semibold text-white text-center">{item.label}</span>
                    </div>
                    {i < ecosystem.length - 1 && (
                      <div className="hidden sm:flex mx-4 items-center">
                        <div className="w-8 h-px bg-[#1E293B]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]/40" />
                        <div className="w-8 h-px bg-[#1E293B]" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="space-y-3">
              {ecosystem.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-start gap-3 bg-[#0B1120] rounded-xl px-4 py-3.5">
                    <div className={`mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${item.color}`}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-sm text-[#94A3B8] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="text-sm text-[#94A3B8] leading-relaxed mt-6">
              CoreZent provides an integrated system where all software can be managed under a{' '}
              <span className="text-white font-medium">single account</span> and a unified license
              framework. We unify fragmented tools to complete your unique, powerful workflow.
            </p>
          </div>
        </div>

        {/* 섹션 4 — Quality */}
        <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-[#1E293B] flex items-center gap-4">
            <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-sm font-bold flex items-center justify-center shrink-0">
              4
            </span>
            <h2 className="text-base font-semibold text-white">Commitment to Quality: Beyond the Software</h2>
          </div>
          <div className="px-7 py-6">
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Selling a product is just the beginning of our responsibility. CoreZent oversees the
              entire user journey. Through our weekly{' '}
              <span className="text-white font-medium">Changelogs</span>, we maintain transparency
              in our development process. We also provide professional-grade{' '}
              <span className="text-white font-medium">Manual Portals</span> to ensure users can
              unlock 100% of the potential within our software.
            </p>
            <p className="text-sm text-[#94A3B8] leading-relaxed mt-4">
              Furthermore, we guarantee top-tier{' '}
              <span className="text-[#38BDF8] font-medium">security and privacy</span> based on the
              stable infrastructure of SM Tech. Your licenses and data are protected by modern
              encryption and can be fully controlled at any time via your Personal Dashboard.
            </p>
          </div>
        </div>

        {/* 섹션 5 — Future */}
        <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
          <div className="px-7 py-5 border-b border-[#1E293B] flex items-center gap-4">
            <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-sm font-bold flex items-center justify-center shrink-0">
              5
            </span>
            <h2 className="text-base font-semibold text-white">The Future: Scaling the Zenith</h2>
          </div>
          <div className="px-7 py-6">
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Our journey is only beginning. CoreZent is currently developing{' '}
              <span className="text-[#38BDF8] font-medium">AI-driven automation</span>, deeper
              system optimization tools, and innovative platforms for developers and creators alike.
            </p>
            <p className="text-sm text-[#94A3B8] leading-relaxed mt-4">
              We don&apos;t create software that follows fleeting trends; we build essential tools
              that will earn a permanent spot on your desktop for years to come. Our quest for the{' '}
              <span className="text-[#38BDF8] font-semibold">Zenith</span> of technology is
              dedicated to making your professional life more valuable every single day.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div
          className="rounded-2xl p-10 text-center"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, #1E293B 0%, #0B1120 100%)',
            border: '1px solid #1E293B',
          }}
        >
          <h3 className="text-2xl font-bold text-white mb-3">
            Experience the CoreZent{' '}
            <span className="text-[#38BDF8]">Ecosystem</span>
          </h3>
          <p className="text-[#94A3B8] text-sm mb-7">
            Discover tools built to elevate your professional workflow.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-[#38BDF8] hover:bg-[#0ea5e9] text-[#0B1120] font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            View Products
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
