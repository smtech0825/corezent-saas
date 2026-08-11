/**
 * @파일: admin/content/features/page.tsx
 * @설명: Features 섹션 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import FeaturesManager from './FeaturesManager'
import PageContainer from '@/components/common/PageContainer'
import { requireAdminOrThrow } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

async function createFeature(icon: string, tag: string, title: string, description: string) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  const { data: maxRow } = await adminClient
    .from('front_features')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single()
  const nextIndex = (maxRow?.order_index ?? -1) + 1
  const { data, error } = await adminClient.from('front_features').insert({ icon, tag, title, description, order_index: nextIndex, is_published: true }).select('id, icon, tag, title, description, is_published, order_index').single()
  if (error) throw new Error(`특징 추가 실패: ${error.message}`)
  revalidatePath('/admin/content/features')
  revalidatePath('/')
  return data
}

async function updateFeature(id: string, icon: string, tag: string, title: string, description: string) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_features').update({ icon, tag, title, description }).eq('id', id)
  if (error) throw new Error(`특징 수정 실패: ${error.message}`)
  revalidatePath('/admin/content/features')
  revalidatePath('/')
}

async function deleteFeature(id: string) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_features').delete().eq('id', id)
  if (error) throw new Error(`특징 삭제 실패: ${error.message}`)
  revalidatePath('/admin/content/features')
  revalidatePath('/')
}

async function toggleFeaturePublish(id: string, published: boolean) {
  'use server'
  await requireAdminOrThrow()
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('front_features').update({ is_published: published }).eq('id', id)
  if (error) throw new Error(`특징 게시 상태 변경 실패: ${error.message}`)
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
    <PageContainer variant="admin-form" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-ink">CoreZent 특징</h1>
        <p className="text-sm text-ink-soft mt-1">
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
    </PageContainer>
  )
}
