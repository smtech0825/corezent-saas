/**
 * @파일: admin/content/how-it-works/page.tsx
 * @설명: How It Works 섹션 단계 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import StepsManager from './StepsManager'
import PageContainer from '@/components/common/PageContainer'
import SaveAndViewButton from '@/app/admin/content/_components/SaveAndViewButton'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { logAdminActivity, summarizeForLog, currentUserIdForLog } from '@/lib/adminActivityLog'

export const dynamic = 'force-dynamic'

type StepData = {
  icon: string
  title: string
  description: string
  is_published: boolean
  order_index: number
}

/** 추가된 단계 한 줄 — 화면 목록에 바로 끼워 넣기 위해 돌려준다 */
type StepRow = StepData & { id: string }

async function createStep(data: StepData): Promise<AdminActionResult<StepRow>> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()
  const { data: created, error } = await adminClient.from('front_steps').insert(data).select('id, icon, title, description, is_published, order_index').single()
  if (error) return dbFailure('단계 추가', error)

  // 감사 기록 — 제목은 그대로, 설명은 요약만
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.step_create',
        targetType: 'front_step',
        targetId: (created as StepRow).id,
        detail: { title: data.title, description: summarizeForLog(data.description) },
      })
    }
  }

  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
  return { status: 'ok', created: created as StepRow }
}

async function updateStep(id: string, data: StepData): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  let before: { icon?: string; title?: string; description?: string } | null = null
  try {
    const { data: b } = await adminClient.from('front_steps').select('icon, title, description').eq('id', id).maybeSingle()
    before = b ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_steps').update(data).eq('id', id)
  if (error) return dbFailure('단계 수정', error)

  // 감사 기록 — 제목·아이콘은 그대로, 설명은 요약만
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.step_update',
        targetType: 'front_step',
        targetId: id,
        detail: {
          // icon은 원본 <svg> 문자열일 수 있어(DynamicIcon 허용) 요약으로만 남긴다
          from: before
            ? { icon: summarizeForLog(before.icon ?? ''), title: before.title, description: summarizeForLog(before.description ?? '') }
            : null,
          to: { icon: summarizeForLog(data.icon), title: data.title, description: summarizeForLog(data.description) },
        },
      })
    }
  }

  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
  return { status: 'ok' }
}

async function deleteStep(id: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 — 지우기 전에 무엇이었는지 확보(조회 실패해도 삭제는 진행)
  let before: { title?: string } | null = null
  try {
    const { data: b } = await adminClient.from('front_steps').select('title').eq('id', id).maybeSingle()
    before = b ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_steps').delete().eq('id', id)
  if (error) return dbFailure('단계 삭제', error)

  // 감사 기록 — 삭제된 단계의 제목
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.step_delete',
        targetType: 'front_step',
        targetId: id,
        detail: { title: before?.title ?? null },
      })
    }
  }

  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
  return { status: 'ok' }
}

async function toggleStepPublish(id: string, published: boolean): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  let beforePublished: boolean | null = null
  try {
    const { data: b } = await adminClient.from('front_steps').select('is_published').eq('id', id).maybeSingle()
    beforePublished = (b?.is_published as boolean | undefined) ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_steps').update({ is_published: published }).eq('id', id)
  if (error) return dbFailure('단계 게시 상태 변경', error)

  // 감사 기록 — 게시 상태의 전/후
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.step_toggle',
        targetType: 'front_step',
        targetId: id,
        detail: { from: beforePublished, to: published },
      })
    }
  }

  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
  return { status: 'ok' }
}

export default async function HowItWorksAdminPage() {
  const adminClient = createAdminClient()

  const { data: steps } = await adminClient
    .from('front_steps')
    .select('id, icon, title, description, is_published, order_index')
    .order('order_index')

  return (
    <PageContainer variant="admin-form" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-serif text-ink">이용 방법</h1>
          <p className="text-sm text-ink-soft mt-1">
            &ldquo;이용 방법&rdquo; 섹션에 표시되는 단계를 관리합니다. 아이콘: Lucide (Zap), Tabler (tb:Cpu), Radix (ri:Star), 또는 원본 &lt;svg&gt;.
          </p>
        </div>
        {/* 항목별 저장이 즉시 반영되는 화면 — 저장할 폼이 없어 바로 새 탭으로 연다 */}
        <SaveAndViewButton url="/#how-it-works" />
      </div>

      <StepsManager
        items={steps ?? []}
        onCreate={createStep}
        onUpdate={updateStep}
        onDelete={deleteStep}
        onTogglePublish={toggleStepPublish}
      />
    </PageContainer>
  )
}
