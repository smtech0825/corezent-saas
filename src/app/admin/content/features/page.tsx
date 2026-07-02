/**
 * @파일: admin/content/features/page.tsx
 * @설명: Features 섹션 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import FeaturesManager from './FeaturesManager'

export const dynamic = 'force-dynamic'

async function createFeature(icon: string, tag: string, title: string, description: string) {
  'use server'
  const adminClient = createAdminClient()
  const { data: maxRow } = await adminClient
    .from('front_features')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single()
  const nextIndex = (maxRow?.order_index ?? -1) + 1
  const { data, error } = await adminClient.from('front_features').insert({ icon, tag, title, description, order_index: nextIndex, is_published: true }).select('id, icon, tag, title, description, is_published, order_index').single()
  if (error) console.error('[createFeature]', error)
  revalidatePath('/admin/content/features')
  revalidatePath('/')
  return data
}

async function updateFeature(id: string, icon: string, tag: string, title: string, description: string) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_features').update({ icon, tag, title, description }).eq('id', id)
  revalidatePath('/admin/content/features')
  revalidatePath('/')
}

async function deleteFeature(id: string) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_features').delete().eq('id', id)
  revalidatePath('/admin/content/features')
  revalidatePath('/')
}

async function toggleFeaturePublish(id: string, published: boolean) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_features').update({ is_published: published }).eq('id', id)
  revalidatePath('/admin/content/features')
  revalidatePath('/')
}

export default async function FeaturesPage() {
  const adminClient = createAdminClient()

  const { data: features } = await adminClient
    .from('front_features')
    .select('id, icon, tag, title, description, is_published, order_index')
    .order('order_index')

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">CoreZent 특징</h1>
        <p className="text-sm text-[#E2E8F0] mt-1">
          랜딩 페이지의 &apos;CoreZent 특징&apos; 섹션에 표시되는 특징 카드를 관리합니다. (Lucide: Zap / Tabler: tb:Cpu / Radix: ri:Star / SVG)
        </p>
      </div>

      <FeaturesManager
        features={features ?? []}
        onCreate={createFeature}
        onUpdate={updateFeature}
        onDelete={deleteFeature}
        onTogglePublish={toggleFeaturePublish}
      />
    </div>
  )
}
