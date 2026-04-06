'use client'

/**
 * @컴포넌트: FAQSection
 * @설명: FAQ 아코디언 섹션 — DB front_faqs 데이터 렌더링
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface DbFaq {
  id: string
  question: string
  answer: string
}

interface Props {
  faqs: DbFaq[]
}

export default function FAQSection({ faqs }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (!faqs || faqs.length === 0) return null

  return (
    <section id="faq" className="relative py-32 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[#38BDF8] text-sm font-semibold tracking-widest uppercase mb-4">
            FAQ
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Frequently asked questions.
          </h2>
          <p className="text-[#94A3B8] text-lg">
            Everything you need to know about CoreZent software and purchases.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-2">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id
            return (
              <div
                key={faq.id}
                className={`border rounded-2xl overflow-hidden transition-colors duration-200 ${
                  isOpen
                    ? 'border-[#38BDF8]/20 bg-[#111A2E]'
                    : 'border-[#1E293B] bg-[#111A2E] hover:border-[#1E293B]/80'
                }`}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                >
                  <span className="text-sm font-semibold text-white pr-4">{faq.question}</span>
                  <ChevronDown
                    size={16}
                    className={`text-[#475569] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#38BDF8]' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-[#94A3B8] leading-relaxed whitespace-pre-wrap">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
