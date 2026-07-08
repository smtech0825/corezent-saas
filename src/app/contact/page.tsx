/**
 * @파일: contact/page.tsx
 * @설명: 비가입자/잠재 고객용 문의 페이지
 *        Navbar + Footer, 문의 폼 (ContactForm), ToastProvider
 */

import type { Metadata } from 'next'
import { Mail } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ContactFormWrapper from './ContactFormWrapper'

export const metadata: Metadata = buildPageMetadata({
  path: '/contact',
  title: '문의하기',
  description: '궁금한 점이나 도움이 필요하신가요? 메시지를 보내주시면 빠르게 답변드리겠습니다.',
})

export default function ContactPage() {
  return (
    <div className="theme-paper min-h-screen bg-paper text-ink font-sans">
      <Navbar />

      {/* Hero */}
      <section className="pt-10 sm:pt-14 pb-4 px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-pen/10 border border-pen/20 mb-6">
          <Mail size={26} className="text-pen" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-black text-ink mb-3">
          문의하기
        </h1>
        <p className="text-ink-soft text-sm sm:text-base max-w-md mx-auto">
          질문, 피드백, 제휴 문의 무엇이든 환영합니다.<br />
          아래 양식을 작성해 주시면 빠르게 답변드리겠습니다.
        </p>
      </section>

      {/* 폼 */}
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-paper-raised border border-rule rounded-lg p-6 sm:p-8 shadow-[0_1px_2px_rgba(35,39,46,0.05)]">
          <ContactFormWrapper />
        </div>
      </section>

      <Footer />
    </div>
  )
}
