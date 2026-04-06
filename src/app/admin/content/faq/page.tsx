/**
 * @파일: admin/content/faq/page.tsx
 * @설명: FAQ 콘텐츠 관리 — 랜딩 페이지 FAQ 섹션 CRUD
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import FaqManager from './FaqManager'

export const dynamic = 'force-dynamic'

async function createFaq(question: string, answer: string) {
  'use server'
  const adminClient = createAdminClient()
  const { data: maxRow } = await adminClient
    .from('front_faqs')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single()
  const nextIndex = (maxRow?.order_index ?? -1) + 1
  await adminClient.from('front_faqs').insert({ question, answer, order_index: nextIndex, is_published: true })
  revalidatePath('/admin/content/faq')
}

async function updateFaq(id: string, question: string, answer: string) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_faqs').update({ question, answer }).eq('id', id)
  revalidatePath('/admin/content/faq')
}

async function deleteFaq(id: string) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_faqs').delete().eq('id', id)
  revalidatePath('/admin/content/faq')
}

async function toggleFaqPublish(id: string, published: boolean) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_faqs').update({ is_published: published }).eq('id', id)
  revalidatePath('/admin/content/faq')
}

export default async function FaqPage() {
  const adminClient = createAdminClient()

  const { data: faqs } = await adminClient
    .from('front_faqs')
    .select('id, question, answer, is_published, order_index')
    .order('order_index')

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">FAQ</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Manage frequently asked questions shown on the landing page.
        </p>
      </div>

      <FaqManager
        faqs={faqs ?? []}
        onCreate={createFaq}
        onUpdate={updateFaq}
        onDelete={deleteFaq}
        onTogglePublish={toggleFaqPublish}
      />
    </div>
  )
}
