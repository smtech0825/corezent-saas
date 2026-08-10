/**
 * @파일: admin/content/how-it-works/page.tsx
 * @설명: How It Works 섹션 단계 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import StepsManager from './StepsManager'
import PageContainer from '@/components/common/PageContainer'
import { requireAdminOrThrow } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

type StepData = {
  icon: string
  title: string
  description: string
  is_published: boolean
  order_index: number
}

async function createStep(data: StepData) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  const { data: created } = await adminClient.from('front_steps').insert(data).select('id, icon, title, description, is_published, order_index').single()
  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
  return created
}

async function updateStep(id: string, data: StepData) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  await adminClient.from('front_steps').update(data).eq('id', id)
  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
}

async function deleteStep(id: string) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_steps').delete().eq('id', id)
  if (error) throw new Error(`단계 삭제 실패: ${error.message}`)
  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
}

async function toggleStepPublish(id: string, published: boolean) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  await adminClient.from('front_steps').update({ is_published: published }).eq('id', id)
  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
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
