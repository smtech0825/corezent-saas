/**
 * @파일: admin/content/how-it-works/page.tsx
 * @설명: How It Works 섹션 단계 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import StepsManager from './StepsManager'

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
  const adminClient = createAdminClient()
  const { data: created } = await adminClient.from('front_steps').insert(data).select('id, icon, title, description, is_published, order_index').single()
  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
  return created
}

async function updateStep(id: string, data: StepData) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_steps').update(data).eq('id', id)
  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
}

async function deleteStep(id: string) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_steps').delete().eq('id', id)
  revalidatePath('/admin/content/how-it-works')
  revalidatePath('/')
}

async function toggleStepPublish(id: string, published: boolean) {
  'use server'
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
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">How It Works</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Manage the steps shown in the &ldquo;How It Works&rdquo; section. Icons: Lucide (Zap), Tabler (tb:Cpu), Radix (ri:Star), or raw &lt;svg&gt;.
        </p>
      </div>

      <StepsManager
        items={steps ?? []}
        onCreate={createStep}
        onUpdate={updateStep}
        onDelete={deleteStep}
        onTogglePublish={toggleStepPublish}
      />
    </div>
  )
}
