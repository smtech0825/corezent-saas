/**
 * @파일: admin/content/about/page.tsx
 * @설명: About 페이지 콘텐츠 관리 — Hero, 통계 카드, 콘텐츠 블록(텍스트+이미지)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import AboutManager from './AboutManager'

export const dynamic = 'force-dynamic'

// ─── Hero (front_content key-value) ─────────────────────────

async function updateHero(title: string, description: string) {
  'use server'
  const c = createAdminClient()
  await Promise.all([
    c.from('front_content').upsert({ key: 'about_title', value: title }),
    c.from('front_content').upsert({ key: 'about_description', value: description }),
  ])
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
}

// ─── Stats CRUD ─────────────────────────────────────────────

type StatData = { icon: string; value: string; label: string }

async function createStat(data: StatData) {
  'use server'
  const c = createAdminClient()
  const { data: maxRow } = await c.from('front_about_stats').select('order_index').order('order_index', { ascending: false }).limit(1).single()
  const idx = (maxRow?.order_index ?? -1) + 1
  const { data: created, error } = await c.from('front_about_stats').insert({ ...data, order_index: idx, is_published: true }).select('id, icon, value, label, order_index, is_published').single()
  if (error) console.error('[createStat]', error)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return created
}

async function updateStat(id: string, data: StatData) {
  'use server'
  const c = createAdminClient()
  await c.from('front_about_stats').update(data).eq('id', id)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
}

async function deleteStat(id: string) {
  'use server'
  const c = createAdminClient()
  await c.from('front_about_stats').delete().eq('id', id)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
}

// ─── Blocks CRUD ────────────────────────────────────────────

type BlockData = { title: string; description: string; images: string[] }

async function createBlock(data: BlockData) {
  'use server'
  const c = createAdminClient()
  const { data: maxRow } = await c.from('front_about_blocks').select('order_index').order('order_index', { ascending: false }).limit(1).single()
  const idx = (maxRow?.order_index ?? -1) + 1
  const { data: created, error } = await c.from('front_about_blocks').insert({ ...data, order_index: idx, is_published: true }).select('id, title, description, images, order_index, is_published').single()
  if (error) console.error('[createBlock]', error)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return created
}

async function updateBlock(id: string, data: BlockData) {
  'use server'
  const c = createAdminClient()
  await c.from('front_about_blocks').update(data).eq('id', id)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
}

async function deleteBlock(id: string) {
  'use server'
  const c = createAdminClient()
  await c.from('front_about_blocks').delete().eq('id', id)
  revalidatePath('/admin/content/about')
  revalidatePath('/about')
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
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">About Page</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Manage the About page — hero text, stats cards, and content blocks with image sliders.
        </p>
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
    </div>
  )
}
