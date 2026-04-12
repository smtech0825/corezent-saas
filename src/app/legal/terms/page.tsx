/**
 * @파일: app/legal/terms/page.tsx
 * @설명: CoreZent 이용약관 (Terms of Service) 페이지
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Terms of Service — CoreZent',
  description: 'Read the CoreZent Terms of Service to understand your rights and responsibilities when using our platform.',
}

const sections = [
  {
    number: '1',
    title: 'About Us and These Terms',
    items: [
      {
        label: 'Welcome',
        text: 'Welcome to CoreZent.com. CoreZent is a digital marketplace that allows members to buy licenses to use digital items like desktop apps, web services, and software code.',
      },
      {
        label: 'License, not ownership',
        text: 'It is important to understand that by purchasing or downloading items on CoreZent, you are only receiving a limited, non-exclusive license to use that item. You do not acquire any rights of ownership in that item.',
        highlight: true,
      },
    ],
  },
  {
    number: '2',
    title: 'Your Account',
    items: [
      {
        label: 'Age',
        text: 'You must be 18 years of age or over to access, use, or subscribe to our site.',
      },
      {
        label: 'Your responsibility',
        text: 'You promise that the information you give us is true, accurate, and complete. You are responsible for any use of the site that occurs in conjunction with your username and password, so keep your password secure.',
      },
    ],
  },
  {
    number: '3',
    title: 'Access and Restrictions',
    intro:
      'Subject to your compliance with these terms, you are granted a non-exclusive, limited, freely revocable license to access and use CoreZent. You must not:',
    bullets: [
      'Interfere with or disrupt the integrity or performance of the site.',
      'Rent, license, sublicense, sell, resell or otherwise commercially exploit any items or intellectual property made available to any third party.',
      'Use any data mining, robots, or other similar data gathering and extraction methods.',
      'Remove any copyright notices or other protective measures from any item.',
    ],
  },
  {
    number: '4',
    title: 'Pricing, Payment, and Taxes',
    items: [
      {
        label: 'Payment processing',
        text: 'You can pay for your items via credit card or other payment methods we may offer. We may use third-party payment processors to facilitate payments.',
      },
      {
        label: 'Currency & Taxes',
        text: 'You are responsible for all costs of currency conversion relating to your transactions. You are also responsible for collecting and paying all taxes associated with your use of, and your transactions on, the site.',
      },
    ],
  },
  {
    number: '5',
    title: 'Refund Policy',
    intro:
      'Given the nature of digital content, we do not generally offer a refund on a purchased item or subscription.',
    items: [
      {
        label: 'Assessment',
        text: 'We will assess refund requests on their merits, at our discretion. However, there is generally no obligation to provide a refund in situations such as: you have changed your mind about an item or subscription, you bought an item by mistake, or you do not have sufficient expertise to use the items made available.',
      },
      {
        label: "EU Customer's Right of Withdrawal",
        text: 'If you reside in the European Union, you may withdraw from your purchase within fourteen (14) days of payment. However, if you have already downloaded, accessed, installed, or otherwise used the purchased content within this period, you may not be eligible for a refund.',
      },
    ],
  },
  {
    number: '6',
    title: 'Intellectual Property',
    plain:
      'All rights, title and interest (including all intellectual property rights) in and to the CoreZent services, sites, platform, and any content (including all software, APIs, products, text, design, logos, and graphics) are owned and/or controlled by us.',
  },
  {
    number: '7',
    title: 'Disclaimer and Limitation of Liability',
    items: [
      {
        label: 'Disclaimer',
        text: 'To the extent permitted under the law, CoreZent and the items are made available to you on an "AS IS" basis and we disclaim all warranties, express or implied. We make no warranty that the site will meet your requirements, be uninterrupted, timely, secure, or error-free.',
      },
      {
        label: 'Limitation',
        text: 'Under no circumstances shall we be liable to you or any third party for any loss of revenue, profit, goodwill, data, or indirect, consequential, or special loss.',
      },
    ],
  },
  {
    number: '8',
    title: 'Termination',
    plain:
      'We can suspend or terminate your account at any time for any reason (acting reasonably), including if you breach these Terms, fail to make any payment when due, or engage in illegal misconduct.',
  },
  {
    number: '9',
    title: 'Governing Law',
    plain:
      'These terms are governed by the laws of the Republic of Korea. Any disputes shall be settled in the competent courts of the Republic of Korea.',
  },
]

export default async function TermsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const supportHref = user ? '/dashboard/support' : '/auth/login'
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
          <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-[#94A3B8] text-base leading-relaxed max-w-2xl">
            Please read these terms carefully before using CoreZent. By accessing or using our platform, you agree to be bound by these terms.
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
                {/* intro 텍스트 */}
                {'intro' in section && section.intro && (
                  <p className="text-sm text-[#94A3B8] leading-relaxed">{section.intro}</p>
                )}

                {/* 순수 텍스트 */}
                {'plain' in section && section.plain && (
                  <p className="text-sm text-[#94A3B8] leading-relaxed">{section.plain}</p>
                )}

                {/* 라벨 + 텍스트 항목 */}
                {'items' in section && section.items && (
                  <div className="space-y-4">
                    {section.items.map((item) => (
                      <div key={item.label} className={`rounded-xl p-4 ${'highlight' in item && item.highlight ? 'bg-[#38BDF8]/5 border border-[#38BDF8]/15' : 'bg-[#0B1120]'}`}>
                        <p className={`text-xs font-semibold mb-1.5 ${'highlight' in item && item.highlight ? 'text-[#38BDF8]' : 'text-white'}`}>
                          {item.label}
                        </p>
                        <p className="text-sm text-[#94A3B8] leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 불릿 리스트 */}
                {'bullets' in section && section.bullets && (
                  <ul className="space-y-2.5">
                    {section.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[#94A3B8] leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#38BDF8]/60 shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 문의 안내 */}
        <div className="mt-10 border border-[#1E293B] bg-[#111A2E] rounded-2xl px-7 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white mb-1">Have questions about these terms?</p>
            <p className="text-sm text-[#94A3B8]">Our support team is happy to help clarify anything.</p>
          </div>
          <Link
            href={supportHref}
            className="shrink-0 bg-[#38BDF8] hover:bg-[#0ea5e9] text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  )
}
