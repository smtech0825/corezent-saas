/**
 * @파일: admin/content/about/page.tsx
 * @설명: About 페이지 콘텐츠 관리 — Hero, 통계 카드, 콘텐츠 블록(텍스트+이미지)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sanitizeRichHtml } from '@/lib/sanitize-html'
import AboutManager from './AboutManager'
import PageContainer from '@/components/common/PageContainer'
import SaveAndViewButton from '@/app/admin/content/_components/SaveAndViewButton'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'

export const dynamic = 'force-dynamic'

/** 추가된 통계·블록 한 줄 — 화면 목록에 바로 끼워 넣기 위해 돌려준다 */
type StatRow = { id: string; icon: string; value: string; label: string; order_index: number; is_published: boolean }
type BlockRow = { id: string; title: string; description: string; images: string[]; order_index: number; is_published: boolean }

// ─── Hero (front_content key-value) ─────────────────────────

async function updateHero(title: string, description: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  // 설명은 리치 HTML — 저장 시점에 서버측 sanitize(콘텐츠 블록·제품 설명과 동일 규칙)
  const cleanDescription = sanitizeRichHtml(description)
  const results = await Promise.all([
    c.from('front_content').upsert({ key: 'about_title', value: title }),
    c.from('front_content').upsert({ key: 'about_description', value: cleanDescription }),
  ])
  const failed = results.find((r) => r.error)
  if (failed?.error) return dbFailure('소개 히어로 저장', failed.error)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok' }
}

// ─── Stats CRUD ─────────────────────────────────────────────

type StatData = { icon: string; value: string; label: string }

async function createStat(data: StatData): Promise<AdminActionResult<StatRow>> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  const { data: maxRow } = await c.from('front_about_stats').select('order_index').order('order_index', { ascending: false }).limit(1).single()
  const idx = (maxRow?.order_index ?? -1) + 1
  const { data: created, error } = await c.from('front_about_stats').insert({ ...data, order_index: idx, is_published: true }).select('id, icon, value, label, order_index, is_published').single()
  if (error) return dbFailure('통계 추가', error)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok', created: created as StatRow }
}

async function updateStat(id: string, data: StatData): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  const { error } = await c.from('front_about_stats').update(data).eq('id', id)
  if (error) return dbFailure('통계 수정', error)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok' }
}

async function deleteStat(id: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  const { error } = await c.from('front_about_stats').delete().eq('id', id)
  if (error) return dbFailure('통계 삭제', error)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok' }
}

// ─── Blocks CRUD ────────────────────────────────────────────

type BlockData = { title: string; description: string; images: string[] }

async function createBlock(data: BlockData): Promise<AdminActionResult<BlockRow>> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  // 설명은 리치 HTML — 저장 시점에 서버측 sanitize(제품 설명과 동일 규칙)
  const clean = { ...data, description: sanitizeRichHtml(data.description) }
  const { data: maxRow } = await c.from('front_about_blocks').select('order_index').order('order_index', { ascending: false }).limit(1).single()
  const idx = (maxRow?.order_index ?? -1) + 1
  const { data: created, error } = await c.from('front_about_blocks').insert({ ...clean, order_index: idx, is_published: true }).select('id, title, description, images, order_index, is_published').single()
  if (error) return dbFailure('블록 추가', error)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok', created: created as BlockRow }
}

async function updateBlock(id: string, data: BlockData): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  // 설명은 리치 HTML — 저장 시점에 서버측 sanitize(제품 설명과 동일 규칙)
  const clean = { ...data, description: sanitizeRichHtml(data.description) }
  const { error } = await c.from('front_about_blocks').update(clean).eq('id', id)
  if (error) return dbFailure('블록 수정', error)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok' }
}

async function deleteBlock(id: string): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  const { error } = await c.from('front_about_blocks').delete().eq('id', id)
  if (error) return dbFailure('블록 삭제', error)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok' }
}

// ─── Page ───────────────────────────────────────────────────

export default async function AboutAdminPage() {
  const c = createAdminClient()

  const [contentRes, statsRes, blocksRes] = await Promise.all([
    c.from('front_content').select('key, value').in('key', ['about_title', 'about_description']),
    c.from('front_about_stats').select('id, icon, value, label, order_index, is_published').order('order_index'),
    c.from('front_about_blocks').select('id, title, description, images, order_index, is_published').order('order_index'),
  ])

  const contentMap = Object.fromEntries((contentRes.data ?? []).map((r) => [r.key, r.value]))

  return (
    <PageContainer variant="admin-form" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink font-serif">소개 페이지</h1>
          <p className="text-sm text-ink-soft mt-1">
            소개 페이지를 관리합니다 — 히어로 텍스트, 통계 카드, 이미지 슬라이더가 포함된 콘텐츠 블록.
          </p>
        </div>
        {/* 통계·블록은 항목별 즉시 저장이지만 히어로 폼은 저장 버튼이 따로 있다 — 안내 문구로 착각 방지 */}
        <div className="flex flex-col items-stretch sm:items-end gap-1">
          <SaveAndViewButton url="/about" />
          <p className="text-xs text-ink-faint">히어로 수정은 먼저 &ldquo;히어로 저장&rdquo;을 누른 뒤 확인하세요.</p>
        </div>
      </div>

      <AboutManager
        heroTitle={contentMap['about_title'] ?? ''}
        heroDescription={contentMap['about_description'] ?? ''}
        stats={statsRes.data ?? []}
        blocks={(blocksRes.data ?? []).map((b) => ({ ...b, images: (b.images ?? []) as string[] }))}
        onUpdateHero={updateHero}
        onCreateStat={createStat}
        onUpdateStat={updateStat}
        onDeleteStat={deleteStat}
        onCreateBlock={createBlock}
        onUpdateBlock={updateBlock}
        onDeleteBlock={deleteBlock}
      />
    </PageContainer>
  )
}
