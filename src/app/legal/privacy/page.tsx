/**
 * @파일: app/legal/privacy/page.tsx
 * @설명: CoreZent 개인정보 처리방침 (Privacy Policy) 페이지
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — CoreZent',
  description: 'Learn how CoreZent collects, uses, and protects your personal information.',
}

const sections = [
  {
    number: '1',
    title: 'Collection and Use of Data',
    plain:
      'By using CoreZent, you grant us a non-exclusive, royalty-free, perpetual, and worldwide right to collect, analyze, and utilize data derived from your use of the site. This includes, but is not limited to, data relating to site activity, user preferences, and transaction patterns. We use this data for our own commercial purposes to improve our digital marketplace.',
  },
  {
    number: '2',
    title: 'Payment Information',
    plain:
      'To facilitate transactions for our software and digital items, we may use one or more third-party payment processors. We do not process payments for any services directly. These payment processing services are subject to the applicable payment processor\'s own terms and conditions and privacy policy. You authorize the applicable payment processor to store your payment information.',
  },
  {
    number: '3',
    title: 'Cookies Policy',
    intro: 'We use cookies to enhance your experience, analyze traffic, and serve personalized content.',
    items: [
      {
        label: 'Necessary cookies',
        text: 'The law states we can store cookies on your device if they are strictly necessary for the operation of the site. These cookies help make the website usable by enabling basic functions like page navigation, website security, and access to information that requires authentication.',
      },
      {
        label: 'Other cookies',
        text: 'For all other types of cookies (such as Preferences, Statistics and Performance, and Marketing cookies), we need your permission. You can at any time change or withdraw your consent using the cookie management settings on our webpage.',
      },
    ],
  },
  {
    number: '4',
    title: 'Security and Confidentiality',
    plain:
      'We employ a number of technical, organizational, and physical safeguards designed to protect your personal and confidential information. However, please note that no security measures are failsafe, and we cannot guarantee the absolute security of your information. We will have no liability to you for any unauthorized access, corruption, deletion, destruction, or loss of any of your information.',
  },
  {
    number: '5',
    title: 'Your Responsibilities',
    items: [
      {
        label: 'Public Information',
        text: 'We strongly recommend that you do not make your contact details (including your email address, street address, and phone number) public on CoreZent or in any public communications, except as required under applicable law.',
      },
      {
        label: "Other Users' Information",
        text: 'While using our marketplace, you may become aware of confidential or personal information about us or other users. You promise to not disclose any confidential or personal information made available to you through CoreZent to any other person.',
      },
    ],
  },
  {
    number: '6',
    title: 'Do Not Sell or Share My Personal Information',
    plain:
      'You can manage your data preferences and exercise your rights by using the "Do Not Sell or Share my Personal Information" links provided in the footer of this webpage.',
  },
]

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-[#94A3B8] text-base leading-relaxed max-w-2xl">
            Your privacy matters to us. This policy explains how we collect, use, and protect your personal information when you use CoreZent.
          </p>
          <p className="text-[#475569] text-sm mt-4">Last updated: April 2025</p>
        </div>

        {/* 섹션 목록 */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.number}
              className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden"
            >
              {/* 섹션 헤더 */}
              <div className="px-7 py-5 border-b border-[#1E293B] flex items-center gap-4">
                <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-sm font-bold flex items-center justify-center shrink-0">
                  {section.number}
                </span>
                <h2 className="text-base font-semibold text-white">{section.title}</h2>
              </div>

              {/* 섹션 내용 */}
              <div className="px-7 py-6 space-y-4">
                {'intro' in section && section.intro && (
                  <p className="text-sm text-[#94A3B8] leading-relaxed">{section.intro}</p>
                )}
                {'plain' in section && section.plain && (
                  <p className="text-sm text-[#94A3B8] leading-relaxed">{section.plain}</p>
                )}
                {'items' in section && section.items && (
                  <div className="space-y-3">
                    {section.items.map((item) => (
                      <div key={item.label} className="bg-[#0B1120] rounded-xl p-4">
                        <p className="text-xs font-semibold text-white mb-1.5">{item.label}</p>
                        <p className="text-sm text-[#94A3B8] leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 문의 안내 */}
        <div className="mt-10 border border-[#1E293B] bg-[#111A2E] rounded-2xl px-7 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white mb-1">Questions about your privacy?</p>
            <p className="text-sm text-[#94A3B8]">Contact us and we'll respond as soon as possible.</p>
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
