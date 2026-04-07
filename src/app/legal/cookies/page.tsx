/**
 * @파일: app/legal/cookies/page.tsx
 * @설명: CoreZent 쿠키 정책 (Cookie Policy) 페이지
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Cookie Policy — CoreZent',
  description: 'Learn how CoreZent uses cookies and similar tracking technologies on our website.',
}

const cookieTypes = [
  {
    name: 'Strictly Necessary',
    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    description:
      'Essential for you to browse the website and use its features, such as accessing secure areas (My Page), authenticating logins, and verifying software license status. Without these, services like the shopping cart and license management cannot be provided.',
  },
  {
    name: 'Performance & Analytics',
    color: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20',
    description:
      'Help us understand how visitors interact with our website by collecting and reporting information anonymously. We use tools like Vercel Analytics and Google Analytics to improve our site performance and user experience.',
  },
  {
    name: 'Functionality',
    color: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
    description:
      'Allow our website to remember choices you make (such as your username or language preference) to provide a more personalized experience.',
  },
  {
    name: 'Security',
    color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    description:
      'Used to identify and prevent security risks, protecting your account and license data from unauthorized access.',
  },
]

const thirdParties = [
  {
    name: 'Payment Processors',
    description: 'To securely handle transactions and prevent fraud.',
  },
  {
    name: 'Authentication Services (Supabase)',
    description: 'To manage secure user login sessions.',
  },
]

const sections = [
  {
    number: '1',
    title: 'Introduction',
    plain:
      'CoreZent uses cookies and similar tracking technologies on www.corezent.com to enhance your browsing experience, analyze site traffic, and provide secure license management. By using our website, you consent to the use of cookies as described in this policy.',
  },
  {
    number: '2',
    title: 'What are Cookies?',
    plain:
      'Cookies are small text files placed on your device to store data that can be recalled by a web server in the domain that placed the cookie. We use both session cookies (which expire once you close your web browser) and persistent cookies (which stay on your device until you delete them).',
  },
  {
    number: '5',
    title: 'Your Choices Regarding Cookies',
    plain:
      'Most web browsers automatically accept cookies, but you can modify your browser settings to decline cookies if you prefer. Please note that if you choose to remove or reject cookies, this could affect the availability and functionality of our services, specifically logging into your account or accessing your license keys. To opt-out of being tracked by Google Analytics across all websites, visit the Google Analytics opt-out page.',
  },
  {
    number: '6',
    title: 'Changes to This Policy',
    plain:
      'We may update our Cookie Policy from time to time. Any changes will be posted on this page with an updated "Last Updated" date. We encourage you to review this policy periodically.',
  },
]

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#0B1120]">
      {/* 헤더 */}
      <div className="border-b border-[#1E293B]">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
            <span className="w-7 h-7 rounded-lg bg-[#38BDF8] flex items-center justify-center text-[#0B1120] text-sm font-black">C</span>
            CoreZent
          </Link>
          <Link href="/" className="text-sm text-[#94A3B8] hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* 타이틀 */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            Legal
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Cookie Policy</h1>
          <p className="text-[#94A3B8] text-base leading-relaxed max-w-2xl">
            This policy explains how CoreZent uses cookies and similar technologies to recognize you when you visit our website.
          </p>
          <p className="text-[#475569] text-sm mt-4">Last updated: April 7, 2026</p>
        </div>

        <div className="space-y-6">
          {/* 섹션 1, 2 */}
          {sections.slice(0, 2).map((section) => (
            <div key={section.number} className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
              <div className="px-7 py-5 border-b border-[#1E293B] flex items-center gap-4">
                <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-sm font-bold flex items-center justify-center shrink-0">
                  {section.number}
                </span>
                <h2 className="text-base font-semibold text-white">{section.title}</h2>
              </div>
              <div className="px-7 py-6">
                <p className="text-sm text-[#94A3B8] leading-relaxed">{section.plain}</p>
              </div>
            </div>
          ))}

          {/* 섹션 3 — 쿠키 종류 카드 */}
          <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
            <div className="px-7 py-5 border-b border-[#1E293B] flex items-center gap-4">
              <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-sm font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <h2 className="text-base font-semibold text-white">How We Use Cookies</h2>
            </div>
            <div className="px-7 py-6">
              <p className="text-sm text-[#94A3B8] leading-relaxed mb-5">
                We use cookies for the following purposes:
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {cookieTypes.map((type) => (
                  <div key={type.name} className="bg-[#0B1120] rounded-xl p-4">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border mb-3 ${type.color}`}>
                      {type.name}
                    </span>
                    <p className="text-sm text-[#94A3B8] leading-relaxed">{type.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 섹션 4 — 서드파티 */}
          <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
            <div className="px-7 py-5 border-b border-[#1E293B] flex items-center gap-4">
              <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-sm font-bold flex items-center justify-center shrink-0">
                4
              </span>
              <h2 className="text-base font-semibold text-white">Third-Party Cookies</h2>
            </div>
            <div className="px-7 py-6 space-y-3">
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                In addition to our own cookies, we may also use various third-party cookies to report usage statistics and deliver services. These may include:
              </p>
              {thirdParties.map((tp) => (
                <div key={tp.name} className="flex items-start gap-3 bg-[#0B1120] rounded-xl px-4 py-3.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#38BDF8]/60 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">{tp.name}</p>
                    <p className="text-sm text-[#94A3B8] mt-0.5">{tp.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 섹션 5, 6 */}
          {sections.slice(2).map((section) => (
            <div key={section.number} className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
              <div className="px-7 py-5 border-b border-[#1E293B] flex items-center gap-4">
                <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-sm font-bold flex items-center justify-center shrink-0">
                  {section.number}
                </span>
                <h2 className="text-base font-semibold text-white">{section.title}</h2>
              </div>
              <div className="px-7 py-6">
                <p className="text-sm text-[#94A3B8] leading-relaxed">{section.plain}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 문의 안내 */}
        <div className="mt-10 border border-[#1E293B] bg-[#111A2E] rounded-2xl px-7 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white mb-1">Questions about our cookie use?</p>
            <p className="text-sm text-[#94A3B8]">
              Email us at{' '}
              <a href="mailto:support@corezent.com" className="text-[#38BDF8] hover:underline">
                support@corezent.com
              </a>
            </p>
          </div>
          <a
            href="mailto:support@corezent.com"
            className="shrink-0 bg-[#38BDF8] hover:bg-[#0ea5e9] text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}
