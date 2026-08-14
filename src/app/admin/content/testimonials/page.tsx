/**
 * @파일: admin/content/testimonials/page.tsx
 * @설명: 고객 후기(Testimonials) 섹션 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import TestimonialsManager from './TestimonialsManager'
import PageContainer from '@/components/common/PageContainer'
import SaveAndViewButton from '@/app/admin/content/_components/SaveAndViewButton'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { logAdminActivity, summarizeForLog, currentUserIdForLog } from '@/lib/adminActivityLog'

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

  // 감사 기록 — 후기 본문은 요약만, 작성자·평점은 짧은 값이라 그대로
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.testimonial_create',
        targetType: 'testimonial',
        targetId: (created as TestimonialRow).id,
        detail: { author: data.author_name, rating: data.rating, quote: summarizeForLog(data.quote) },
      })
    }
  }

  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
  return { status: 'ok', created: created as TestimonialRow }
}

async function updateTestimonial(id: string, data: TestimonialData): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  let before: { quote?: string; author_name?: string; author_title?: string; rating?: number } | null = null
  try {
    const { data: b } = await adminClient.from('front_interviews').select('quote, author_name, author_title, rating').eq('id', id).maybeSingle()
    before = b ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_interviews').update(data).eq('id', id)
  if (error) return dbFailure('고객 후기 수정', error)

  // 감사 기록 — 후기 본문은 요약만, 나머지는 짧은 값이라 그대로
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.testimonial_update',
        targetType: 'testimonial',
        targetId: id,
        detail: {
          from: before
            ? { author: before.author_name, rating: before.rating, quote: summarizeForLog(before.quote ?? '') }
            : null,
          to: { author: data.author_name, rating: data.rating, quote: summarizeForLog(data.quote) },
        },
      })
    }
  }

  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
  return { status: 'ok' }
}

async function deleteTestimonial(id: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 — 지우기 전에 무엇이었는지 확보(조회 실패해도 삭제는 진행)
  let before: { quote?: string; author_name?: string } | null = null
  try {
    const { data: b } = await adminClient.from('front_interviews').select('quote, author_name').eq('id', id).maybeSingle()
    before = b ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_interviews').delete().eq('id', id)
  if (error) return dbFailure('고객 후기 삭제', error)

  // 감사 기록 — 삭제된 후기의 작성자와 본문 요약
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.testimonial_delete',
        targetType: 'testimonial',
        targetId: id,
        detail: { author: before?.author_name ?? null, quote: summarizeForLog(before?.quote ?? '') },
      })
    }
  }

  revalidatePath('/admin/content/testimonials')
  revalidatePath('/')
  return { status: 'ok' }
}

async function toggleTestimonialPublish(id: string, published: boolean): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  let beforePublished: boolean | null = null
  try {
    const { data: b } = await adminClient.from('front_interviews').select('is_published').eq('id', id).maybeSingle()
    beforePublished = (b?.is_published as boolean | undefined) ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_interviews').update({ is_published: published }).eq('id', id)
  if (error) return dbFailure('고객 후기 게시 상태 변경', error)

  // 감사 기록 — 게시 상태의 전/후
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.testimonial_toggle',
        targetType: 'testimonial',
        targetId: id,
        detail: { from: beforePublished, to: published },
      })
    }
  }

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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-serif text-ink">고객 후기</h1>
          <p className="text-sm text-ink-soft mt-1">
            고객 후기 섹션에 표시되는 고객 후기를 관리합니다.
          </p>
        </div>
        {/* 항목별 저장이 즉시 반영되는 화면 — 저장할 폼이 없어 바로 새 탭으로 연다 */}
        <SaveAndViewButton url="/#testimonials" />
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
