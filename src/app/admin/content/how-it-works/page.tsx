/**
 * @파일: admin/content/how-it-works/page.tsx
 * @설명: How It Works 섹션 단계 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import StepsManager from './StepsManager'
import PageContainer from '@/components/common/PageContainer'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'

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
  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
  return { status: 'ok', created: created as StepRow }
}

async function updateStep(id: string, data: StepData): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_steps').update(data).eq('id', id)
  if (error) return dbFailure('단계 수정', error)
  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
  return { status: 'ok' }
}

async function deleteStep(id: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_steps').delete().eq('id', id)
  if (error) return dbFailure('단계 삭제', error)
  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
  return { status: 'ok' }
}

async function toggleStepPublish(id: string, published: boolean): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_steps').update({ is_published: published }).eq('id', id)
  if (error) return dbFailure('단계 게시 상태 변경', error)
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
      <div>
        <h1 className="text-2xl font-bold font-serif text-ink">이용 방법</h1>
        <p className="text-sm text-ink-soft mt-1">
          &ldquo;이용 방법&rdquo; 섹션에 표시되는 단계를 관리합니다. 아이콘: Lucide (Zap), Tabler (tb:Cpu), Radix (ri:Star), 또는 원본 &lt;svg&gt;.
        </p>
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
