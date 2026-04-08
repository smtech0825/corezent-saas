/**
 * @파일: admin/content/testimonials/page.tsx
 * @설명: 고객 후기(Testimonials) 섹션 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import TestimonialsManager from './TestimonialsManager'

export const dynamic = 'force-dynamic'

type TestimonialData = {
  quote: string
  author_name: string
  author_title: string
  author_avatar: string | null
  rating: number
  is_published: boolean
}

async function createTestimonial(data: TestimonialData) {
  'use server'
  const adminClient = createAdminClient()
  const { data: created, error } = await adminClient.from('front_interviews').insert(data).select('id, quote, author_name, author_title, author_avatar, rating, is_published').single()
  if (error) console.error('[createTestimonial]', error)
  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
  return created
}

async function updateTestimonial(id: string, data: TestimonialData) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_interviews').update(data).eq('id', id)
  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
}

async function deleteTestimonial(id: string) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_interviews').delete().eq('id', id)
  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
}

async function toggleTestimonialPublish(id: string, published: boolean) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_interviews').update({ is_published: published }).eq('id', id)
  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
}

export default async function TestimonialsPage() {
  const adminClient = createAdminClient()

  const { data: testimonials } = await adminClient
    .from('front_interviews')
    .select('id, quote, author_name, author_title, author_avatar, rating, is_published')
    .order('created_at')

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Testimonials</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Manage customer testimonials shown in the Testimonials section.
        </p>
      </div>

      <TestimonialsManager
        items={testimonials ?? []}
        onCreate={createTestimonial}
        onUpdate={updateTestimonial}
        onDelete={deleteTestimonial}
        onTogglePublish={toggleTestimonialPublish}
      />
    </div>
  )
}
