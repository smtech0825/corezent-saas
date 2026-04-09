/**
 * @파일: contact/page.tsx
 * @설명: 비가입자/잠재 고객용 문의 페이지
 *        Navbar + Footer, 문의 폼 (ContactForm), ToastProvider
 */

import type { Metadata } from 'next'
import { Mail } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ContactFormWrapper from './ContactFormWrapper'

export const metadata: Metadata = {
  title: 'Contact — CoreZent',
  description: 'Have a question or need help? Send us a message and we\'ll get back to you shortly.',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] font-sans">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-4 px-4 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 mb-6">
          <Mail size={26} className="text-[#38BDF8]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Get in Touch
        </h1>
        <p className="text-[#94A3B8] text-sm sm:text-base max-w-md mx-auto">
          Have a question, feedback, or partnership inquiry?<br />
          Fill out the form below and we&apos;ll get back to you soon.
        </p>
      </section>

      {/* 폼 */}
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-[#111A2E] border border-[#1E293B] rounded-2xl p-6 sm:p-8">
          <ContactFormWrapper />
        </div>
      </section>

      <Footer />
    </div>
  )
}
