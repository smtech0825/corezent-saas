/**
 * @파일: admin/content/features/page.tsx
 * @설명: Features 섹션 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import FeaturesManager from './FeaturesManager'
import PageContainer from '@/components/common/PageContainer'
import SaveAndViewButton from '@/app/admin/content/_components/SaveAndViewButton'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { logAdminActivity, summarizeForLog, currentUserIdForLog } from '@/lib/adminActivityLog'

export const dynamic = 'force-dynamic'

/** 추가된 특징 한 줄 — 화면 목록에 바로 끼워 넣기 위해 돌려준다 */
type FeatureRow = { id: string; icon: string | null; tag: string | null; title: string; description: string; is_published: boolean; order_index: number }

async function createFeature(icon: string, tag: string, title: string, description: string): Promise<AdminActionResult<FeatureRow>> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()
  const { data: maxRow } = await adminClient
    .from('front_features')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .single()
  const nextIndex = (maxRow?.order_index ?? -1) + 1
  const { data, error } = await adminClient.from('front_features').insert({ icon, tag, title, description, order_index: nextIndex, is_published: true }).select('id, icon, tag, title, description, is_published, order_index').single()
  if (error) return dbFailure('특징 추가', error)

  // 감사 기록 — 제목·태그는 그대로, 설명은 요약만
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.feature_create',
        targetType: 'front_feature',
        targetId: (data as FeatureRow).id,
        detail: { title, tag, description: summarizeForLog(description) },
      })
    }
  }

  revalidatePath('/admin/content/features')
  revalidatePath('/')
  return { status: 'ok', created: data as FeatureRow }
}

async function updateFeature(id: string, icon: string, tag: string, title: string, description: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  let before: { icon?: string | null; tag?: string | null; title?: string; description?: string } | null = null
  try {
    const { data: b } = await adminClient.from('front_features').select('icon, tag, title, description').eq('id', id).maybeSingle()
    before = b ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_features').update({ icon, tag, title, description }).eq('id', id)
  if (error) return dbFailure('특징 수정', error)

  // 감사 기록 — 제목·태그·아이콘은 그대로, 설명은 요약만
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.feature_update',
        targetType: 'front_feature',
        targetId: id,
        detail: {
          // icon은 원본 <svg> 문자열일 수 있어(DynamicIcon 허용) 요약으로만 남긴다
          from: before
            ? { icon: summarizeForLog(before.icon ?? ''), tag: before.tag, title: before.title, description: summarizeForLog(before.description ?? '') }
            : null,
          to: { icon: summarizeForLog(icon), tag, title, description: summarizeForLog(description) },
        },
      })
    }
  }

  revalidatePath('/admin/content/features')
  revalidatePath('/')
  return { status: 'ok' }
}

async function deleteFeature(id: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 — 지우기 전에 무엇이었는지 확보(조회 실패해도 삭제는 진행)
  let before: { title?: string } | null = null
  try {
    const { data: b } = await adminClient.from('front_features').select('title').eq('id', id).maybeSingle()
    before = b ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_features').delete().eq('id', id)
  if (error) return dbFailure('특징 삭제', error)

  // 감사 기록 — 삭제된 특징의 제목
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.feature_delete',
        targetType: 'front_feature',
        targetId: id,
        detail: { title: before?.title ?? null },
      })
    }
  }

  revalidatePath('/admin/content/features')
  revalidatePath('/')
  return { status: 'ok' }
}

async function toggleFeaturePublish(id: string, published: boolean): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  let beforePublished: boolean | null = null
  try {
    const { data: b } = await adminClient.from('front_features').select('is_published').eq('id', id).maybeSingle()
    beforePublished = (b?.is_published as boolean | undefined) ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await adminClient.from('front_features').update({ is_published: published }).eq('id', id)
  if (error) return dbFailure('특징 게시 상태 변경', error)

  // 감사 기록 — 게시 상태의 전/후
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.feature_toggle',
        targetType: 'front_feature',
        targetId: id,
        detail: { from: beforePublished, to: published },
      })
    }
  }

  revalidatePath('/admin/content/features')
  revalidatePath('/')
  return { status: 'ok' }
}

export default async function FeaturesPage() {
  const adminClient = createAdminClient()

  const { data: features } = await adminClient
    .from('front_features')
    .select('id, icon, tag, title, description, is_published, order_index')
    .order('order_index')

  return (
    <PageContainer variant="admin-form" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-serif text-ink">CoreZent 특징</h1>
          <p className="text-sm text-ink-soft mt-1">
            랜딩 페이지의 &apos;CoreZent 특징&apos; 섹션에 표시되는 특징 카드를 관리합니다. (Lucide: Zap / Tabler: tb:Cpu / Radix: ri:Star / SVG)
          </p>
        </div>
        {/* 항목별 저장이 즉시 반영되는 화면 — 저장할 폼이 없어 바로 새 탭으로 연다 */}
        <SaveAndViewButton url="/#features" />
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
