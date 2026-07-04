'use client'

/**
 * @컴포넌트: FAQSection
 * @설명: FAQ 아코디언 (페이퍼 테마) — DB front_faqs 데이터 렌더링.
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Container from '@/components/ui/Container'
import { SectionHeader } from '@/components/ui/Section'

export interface DbFaq {
  id: string
  question: string
  /** 서버에서 renderRichHtml로 정제된 안전 HTML(클라이언트는 sanitize 불가하므로 서버가 준비) */
  answerHtml: string
}

interface Props {
  faqs: DbFaq[]
}

export default function FAQSection({ faqs }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (!faqs || faqs.length === 0) return null

  return (
    <section id="faq" className="py-16 sm:py-24 bg-paper-shade/60 border-y border-rule">
      <Container width="text">
        <SectionHeader label="FAQ" title="자주 묻는 질문" align="center" />

        <div className="border-t border-rule">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id
            return (
              <div key={faq.id} className="border-b border-rule">
                <button
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="w-full flex items-center justify-between py-5 text-left gap-4"
                  aria-expanded={isOpen}
                >
                  <span className="font-serif text-base font-bold text-ink break-keep">{faq.question}</span>
                  <ChevronDown
                    size={18}
                    className={`text-ink-faint shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-pen' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="pb-5 pr-8">
                    {/* 답변은 서버에서 정제된 리치 HTML — 단락/서식·정렬 반영(.rich-content 스코프 스타일) */}
                    <div
                      className="rich-content break-keep"
                      dangerouslySetInnerHTML={{ __html: faq.answerHtml }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
