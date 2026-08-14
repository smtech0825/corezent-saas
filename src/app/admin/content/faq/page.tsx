/**
 * @파일: admin/content/faq/page.tsx
 * @설명: FAQ 콘텐츠 관리 — 랜딩 페이지 FAQ 섹션 CRUD
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sanitizeRichHtml } from '@/lib/sanitize-html'
import FaqManager from './FaqManager'
import PageContainer from '@/components/common/PageContainer'
import SaveAndViewButton from '@/app/admin/content/_components/SaveAndViewButton'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { logAdminActivity, summarizeForLog, currentUserIdForLog } from '@/lib/adminActivityLog'

export const dynamic = 'force-dynamic'

/** 추가된 FAQ 한 줄 — 화면 목록에 바로 끼워 넣기 위해 돌려준다 */
type FaqRow = { id: string; question: string; answer: string; is_published: boolean; order_index: number }

async function createFaq(question: string, answer: string): Promise<AdminActionResult<FaqRow>> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
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
  if (error) return dbFailure('FAQ 추가', error)

  // 감사 기록 — 질문·답변(리치 HTML)은 요약만 남긴다
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.faq_create',
        targetType: 'front_faq',
        targetId: (data as FaqRow).id,
        detail: { question: summarizeForLog(question), answer: summarizeForLog(data.answer) },
      })
    }
  }

  revalidatePath('/admin/content/faq')
  revalidatePath('/faq')
  revalidatePath('/')
  return { status: 'ok', created: data as FaqRow }
}

async function updateFaq(id: string, question: string, answer: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  let before: { question?: string; answer?: string } | null = null
  try {
    const { data: b } = await adminClient.from('front_faqs').select('question, answer').eq('id', id).maybeSingle()
    before = b ?? null
  } catch { /* 전값 없이 기록 */ }

  const cleanAnswer = sanitizeRichHtml(answer)
  const { error } = await adminClient.from('front_faqs').update({ question, answer: cleanAnswer }).eq('id', id)
  if (error) return dbFailure('FAQ 수정', error)

  // 감사 기록 — 질문·답변 모두 요약만(전문 금지)
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.faq_update',
        targetType: 'front_faq',
        targetId: id,
        detail: {
          from: before ? { question: summarizeForLog(before.question ?? ''), answer: summarizeForLog(before.answer ?? '') } : null,
          to: { question: summarizeForLog(question), answer: summarizeForLog(cleanAnswer) },
        },
      })
    }
  }

  revalidatePath('/admin/content/faq')
  revalidatePath('/faq')
  revalidatePath('/')
  return { status: 'ok' }
}

async function deleteFaq(id: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 — 지우기 전에 무엇이었는지 확보(조회 실패해도 삭제는 진행)
  let before: { question?: string } | null = null
  try {
    const { data: b } = await adminClient.from('front_faqs').select('question').eq('id', id).maybeSingle()
    before = b ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_faqs').delete().eq('id', id)
  if (error) return dbFailure('FAQ 삭제', error)

  // 감사 기록 — 삭제된 질문 요약
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.faq_delete',
        targetType: 'front_faq',
        targetId: id,
        detail: { question: summarizeForLog(before?.question ?? '') },
      })
    }
  }

  revalidatePath('/admin/content/faq')
  revalidatePath('/faq')
  revalidatePath('/')
  return { status: 'ok' }
}

async function toggleFaqPublish(id: string, published: boolean): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  let beforePublished: boolean | null = null
  try {
    const { data: b } = await adminClient.from('front_faqs').select('is_published').eq('id', id).maybeSingle()
    beforePublished = (b?.is_published as boolean | undefined) ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_faqs').update({ is_published: published }).eq('id', id)
  if (error) return dbFailure('FAQ 게시 상태 변경', error)

  // 감사 기록 — 게시 상태의 전/후
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.faq_toggle',
        targetType: 'front_faq',
        targetId: id,
        detail: { from: beforePublished, to: published },
      })
    }
  }

  revalidatePath('/admin/content/faq')
  revalidatePath('/faq')
  revalidatePath('/')
  return { status: 'ok' }
}

export default async function FaqPage() {
  const adminClient = createAdminClient()

  const { data: faqs } = await adminClient
    .from('front_faqs')
    .select('id, question, answer, is_published, order_index')
    .order('order_index')

  return (
    <PageContainer variant="admin-form" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-serif text-ink">FAQ</h1>
          <p className="text-sm text-ink-soft mt-1">
            랜딩 페이지에 표시되는 자주 묻는 질문을 관리합니다.
          </p>
        </div>
        {/* 항목별 저장이 즉시 반영되는 화면 — 저장할 폼이 없어 바로 새 탭으로 연다 */}
        <SaveAndViewButton url="/faq" />
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
