/**
 * @파일: admin/content/features/page.tsx
 * @설명: Features 섹션 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import FeaturesManager from './FeaturesManager'

export const dynamic = 'force-dynamic'

async function createFeature(icon: string, title: string, description: string) {
  'use server'
  const adminClient = createAdminClient()
  const { data: maxRow } = await adminClient
    .from('front_features')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single()
  const nextIndex = (maxRow?.order_index ?? -1) + 1
  const { data } = await adminClient.from('front_features').insert({ icon, title, description, order_index: nextIndex, is_published: true }).select('id, icon, title, description, is_published, order_index').single()
  revalidatePath('/admin/content/features')
  return data
}

async function updateFeature(id: string, icon: string, title: string, description: string) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_features').update({ icon, title, description }).eq('id', id)
  revalidatePath('/admin/content/features')
}

async function deleteFeature(id: string) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_features').delete().eq('id', id)
  revalidatePath('/admin/content/features')
}

async function toggleFeaturePublish(id: string, published: boolean) {
  'use server'
  const adminClient = createAdminClient()
  await adminClient.from('front_features').update({ is_published: published }).eq('id', id)
  revalidatePath('/admin/content/features')
}

export default async function FeaturesPage() {
  const adminClient = createAdminClient()

  const { data: features } = await adminClient
    .from('front_features')
    .select('id, icon, title, description, is_published, order_index')
    .order('order_index')

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Why CoreZent</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Manage feature cards shown in the &apos;Why CoreZent&apos; section on the landing page. (Lucide: Zap / Tabler: tb:Cpu / Radix: ri:Star / SVG)
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
