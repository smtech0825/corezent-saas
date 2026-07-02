/**
 * @파일: app/faq/page.tsx
 * @설명: 공개 FAQ 페이지 — front_faqs 테이블에서 게시된 항목을 불러와 FAQSection으로 렌더링
 */

import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import FAQSection from '@/components/sections/FAQSection'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'CoreZent 소프트웨어와 구매에 대해 자주 묻는 질문.',
}

export default async function FaqPage() {
  const adminClient = createAdminClient()

  const { data: faqs } = await adminClient
    .from('front_faqs')
    .select('id, question, answer')
    .eq('is_published', true)
    .order('order_index')

  return (
    <div className="theme-paper min-h-screen bg-paper text-ink flex flex-col">
      <Navbar />

      <main className="flex-1 pt-10 sm:pt-14">
        {faqs && faqs.length > 0 ? (
          <FAQSection faqs={faqs} />
        ) : (
          <div className="flex items-center justify-center py-40">
            <p className="text-ink-faint text-sm">아직 등록된 FAQ가 없습니다.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
