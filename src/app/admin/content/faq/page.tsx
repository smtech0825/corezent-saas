/**
 * @파일: admin/content/faq/page.tsx
 * @설명: FAQ 콘텐츠 관리 — 랜딩 페이지 FAQ 섹션 CRUD
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sanitizeRichHtml } from '@/lib/sanitize-html'
import FaqManager from './FaqManager'
import PageContainer from '@/components/common/PageContainer'
import { requireAdminOrThrow } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

async function createFaq(question: string, answer: string) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  const { data: maxRow } = await adminClient
    .from('front_faqs')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single()
  const nextIndex = (maxRow?.order_index ?? -1) + 1
  // 답변은 리치 HTML — 저장 시점에 서버측 sanitize(제품 설명과 동일 규칙)
  const { data, error } = await adminClient.from('front_faqs').insert({ question, answer: sanitizeRichHtml(answer), order_index: nextIndex, is_published: true }).select('id, question, answer, is_published, order_index').single()
  if (error) throw new Error(`FAQ 추가 실패: ${error.message}`)
  revalidatePath('/admin/content/faq')
  revalidatePath('/faq')
  revalidatePath('/')
  return data
}

async function updateFaq(id: string, question: string, answer: string) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_faqs').update({ question, answer: sanitizeRichHtml(answer) }).eq('id', id)
  if (error) throw new Error(`FAQ 수정 실패: ${error.message}`)
  revalidatePath('/admin/content/faq')
  revalidatePath('/faq')
  revalidatePath('/')
}

async function deleteFaq(id: string) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_faqs').delete().eq('id', id)
  if (error) throw new Error(`FAQ 삭제 실패: ${error.message}`)
  revalidatePath('/admin/content/faq')
  revalidatePath('/faq')
  revalidatePath('/')
}

async function toggleFaqPublish(id: string, published: boolean) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_faqs').update({ is_published: published }).eq('id', id)
  if (error) throw new Error(`FAQ 게시 상태 변경 실패: ${error.message}`)
  revalidatePath('/admin/content/faq')
  revalidatePath('/faq')
  revalidatePath('/')
}

export default async function FaqPage() {
  const adminClient = createAdminClient()

  const { data: faqs } = await adminClient
    .from('front_faqs')
    .select('id, question, answer, is_published, order_index')
    .order('order_index')

  return (
    <PageContainer variant="admin-form" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-ink">FAQ</h1>
        <p className="text-sm text-ink-soft mt-1">
          랜딩 페이지에 표시되는 자주 묻는 질문을 관리합니다.
        </p>
      </div>

      <FaqManager
        faqs={faqs ?? []}
        onCreate={createFaq}
        onUpdate={updateFaq}
        onDelete={deleteFaq}
        onTogglePublish={toggleFaqPublish}
      />
    </PageContainer>
  )
}
