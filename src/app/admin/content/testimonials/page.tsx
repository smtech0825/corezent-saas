/**
 * @파일: admin/content/testimonials/page.tsx
 * @설명: 고객 후기(Testimonials) 섹션 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import TestimonialsManager from './TestimonialsManager'
import PageContainer from '@/components/common/PageContainer'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'

export const dynamic = 'force-dynamic'

type TestimonialData = {
  quote: string
  author_name: string
  author_title: string
  author_avatar: string | null
  rating: number
  is_published: boolean
}

/** 추가된 후기 한 줄 — 화면 목록에 바로 끼워 넣기 위해 돌려준다 */
type TestimonialRow = TestimonialData & { id: string }

async function createTestimonial(data: TestimonialData): Promise<AdminActionResult<TestimonialRow>> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()
  const { data: created, error } = await adminClient.from('front_interviews').insert(data).select('id, quote, author_name, author_title, author_avatar, rating, is_published').single()
  if (error) return dbFailure('고객 후기 추가', error)
  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
  return { status: 'ok', created: created as TestimonialRow }
}

async function updateTestimonial(id: string, data: TestimonialData): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_interviews').update(data).eq('id', id)
  if (error) return dbFailure('고객 후기 수정', error)
  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
  return { status: 'ok' }
}

async function deleteTestimonial(id: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_interviews').delete().eq('id', id)
  if (error) return dbFailure('고객 후기 삭제', error)
  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
  return { status: 'ok' }
}

async function toggleTestimonialPublish(id: string, published: boolean): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_interviews').update({ is_published: published }).eq('id', id)
  if (error) return dbFailure('고객 후기 게시 상태 변경', error)
  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
  return { status: 'ok' }
}

export default async function TestimonialsPage() {
  const adminClient = createAdminClient()

  const { data: testimonials } = await adminClient
    .from('front_interviews')
    .select('id, quote, author_name, author_title, author_avatar, rating, is_published')
    .order('created_at')

  return (
    <PageContainer variant="admin-form" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-ink">고객 후기</h1>
        <p className="text-sm text-ink-soft mt-1">
          고객 후기 섹션에 표시되는 고객 후기를 관리합니다.
        </p>
      </div>

      <TestimonialsManager
        items={testimonials ?? []}
        onCreate={createTestimonial}
        onUpdate={updateTestimonial}
        onDelete={deleteTestimonial}
        onTogglePublish={toggleTestimonialPublish}
      />
    </PageContainer>
  )
}
