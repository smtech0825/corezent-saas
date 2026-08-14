'use server'

/**
 * @파일: admin/content/about/actions.ts
 * @설명: About 페이지 관리 서버 액션 — 히어로 저장, 통계·블록 CRUD(전부 관리자 전용).
 *        감사 기록 추가로 page.tsx가 300줄을 넘겨 액션을 이 파일로 분리했다(동작 불변).
 *        긴 문구(설명·리치 HTML)는 summarizeForLog 요약만 기록하고, 기록·전값 조회 실패가
 *        본 작업(저장·삭제)을 막지 않는다.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sanitizeRichHtml } from '@/lib/sanitize-html'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { logAdminActivity, summarizeForLog, currentUserIdForLog } from '@/lib/adminActivityLog'

/** 추가된 통계·블록 한 줄 — 화면 목록에 바로 끼워 넣기 위해 돌려준다 */
export type StatRow = { id: string; icon: string; value: string; label: string; order_index: number; is_published: boolean }
export type BlockRow = { id: string; title: string; description: string; images: string[]; order_index: number; is_published: boolean }
export type StatData = { icon: string; value: string; label: string }
export type BlockData = { title: string; description: string; images: string[] }

// ─── Hero (front_content key-value) ─────────────────────────

/** 소개 히어로(제목·설명) 저장 — 설명은 서버측 sanitize 후 저장 */
export async function updateHero(title: string, description: string): Promise<AdminActionResult> {
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  // 설명은 리치 HTML — 저장 시점에 서버측 sanitize(콘텐츠 블록·제품 설명과 동일 규칙)
  const cleanDescription = sanitizeRichHtml(description)

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  const beforeMap = new Map<string, string>()
  try {
    const { data: beforeRows } = await c
      .from('front_content').select('key, value').in('key', ['about_title', 'about_description'])
    ;(beforeRows ?? []).forEach((r) => beforeMap.set(r.key, r.value ?? ''))
  } catch { /* 전값 없이 기록 */ }

  const results = await Promise.all([
    c.from('front_content').upsert({ key: 'about_title', value: title }),
    c.from('front_content').upsert({ key: 'about_description', value: cleanDescription }),
  ])
  const failed = results.find((r) => r.error)
  if (failed?.error) return dbFailure('소개 히어로 저장', failed.error)

  // 감사 기록 — 제목은 짧은 값 규칙, 설명(리치 HTML)은 요약만
  const changed: Array<Record<string, unknown>> = []
  const beforeTitle = beforeMap.get('about_title') ?? ''
  if (beforeTitle !== title) {
    changed.push(beforeTitle.length <= 80 && title.length <= 80
      ? { key: 'about_title', from: beforeTitle, to: title }
      : { key: 'about_title', from: summarizeForLog(beforeTitle), to: summarizeForLog(title) })
  }
  const beforeDesc = beforeMap.get('about_description') ?? ''
  if (beforeDesc !== cleanDescription) {
    changed.push({ key: 'about_description', from: summarizeForLog(beforeDesc), to: summarizeForLog(cleanDescription) })
  }
  if (changed.length > 0) {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.about_hero_update',
        targetType: 'front_content',
        targetId: 'about_hero',
        detail: { changed },
      })
    }
  }

  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok' }
}

// ─── Stats CRUD ─────────────────────────────────────────────

/** 통계 카드 추가 — 다음 순서 번호로 게시 상태로 넣는다 */
export async function createStat(data: StatData): Promise<AdminActionResult<StatRow>> {
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  const { data: maxRow } = await c.from('front_about_stats').select('order_index').order('order_index', { ascending: false }).limit(1).single()
  const idx = (maxRow?.order_index ?? -1) + 1
  const { data: created, error } = await c.from('front_about_stats').insert({ ...data, order_index: idx, is_published: true }).select('id, icon, value, label, order_index, is_published').single()
  if (error) return dbFailure('통계 추가', error)

  // 감사 기록 — 통계 카드는 값이 짧아 그대로 남긴다
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.about_stat_create',
        targetType: 'about_stat',
        targetId: (created as StatRow).id,
        // icon은 원본 <svg> 문자열일 수 있어(DynamicIcon 허용) 요약으로만 남긴다
        detail: { to: { icon: summarizeForLog(data.icon), value: data.value, label: data.label } },
      })
    }
  }

  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok', created: created as StatRow }
}

/** 통계 카드 수정 — 전/후 값을 감사 기록에 남긴다 */
export async function updateStat(id: string, data: StatData): Promise<AdminActionResult> {
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  let before: StatData | null = null
  try {
    const { data: b } = await c.from('front_about_stats').select('icon, value, label').eq('id', id).maybeSingle()
    before = (b as StatData) ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await c.from('front_about_stats').update(data).eq('id', id)
  if (error) return dbFailure('통계 수정', error)

  // 감사 기록 — 값이 전부 짧아 전/후 그대로 남긴다
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.about_stat_update',
        targetType: 'about_stat',
        targetId: id,
        // icon은 원본 <svg> 문자열일 수 있어(DynamicIcon 허용) 요약으로만 남긴다
        detail: {
          from: before ? { icon: summarizeForLog(before.icon), value: before.value, label: before.label } : null,
          to: { icon: summarizeForLog(data.icon), value: data.value, label: data.label },
        },
      })
    }
  }

  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok' }
}

/** 통계 카드 삭제 — 지우기 전 내용을 감사 기록에 남긴다 */
export async function deleteStat(id: string): Promise<AdminActionResult> {
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()

  // 감사 기록용 — 지우기 전에 무엇이었는지 확보(조회 실패해도 삭제는 진행)
  let before: StatData | null = null
  try {
    const { data: b } = await c.from('front_about_stats').select('icon, value, label').eq('id', id).maybeSingle()
    before = (b as StatData) ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await c.from('front_about_stats').delete().eq('id', id)
  if (error) return dbFailure('통계 삭제', error)

  // 감사 기록 — 삭제된 카드의 내용(짧은 값 그대로)
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.about_stat_delete',
        targetType: 'about_stat',
        targetId: id,
        // icon은 원본 <svg> 문자열일 수 있어(DynamicIcon 허용) 요약으로만 남긴다
        detail: { from: before ? { icon: summarizeForLog(before.icon), value: before.value, label: before.label } : null },
      })
    }
  }

  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok' }
}

// ─── Blocks CRUD ────────────────────────────────────────────

/** 콘텐츠 블록 추가 — 설명은 서버측 sanitize 후 다음 순서 번호로 넣는다 */
export async function createBlock(data: BlockData): Promise<AdminActionResult<BlockRow>> {
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  // 설명은 리치 HTML — 저장 시점에 서버측 sanitize(제품 설명과 동일 규칙)
  const clean = { ...data, description: sanitizeRichHtml(data.description) }
  const { data: maxRow } = await c.from('front_about_blocks').select('order_index').order('order_index', { ascending: false }).limit(1).single()
  const idx = (maxRow?.order_index ?? -1) + 1
  const { data: created, error } = await c.from('front_about_blocks').insert({ ...clean, order_index: idx, is_published: true }).select('id, title, description, images, order_index, is_published').single()
  if (error) return dbFailure('블록 추가', error)

  // 감사 기록 — 제목·이미지 수만. 설명(리치 HTML)은 요약만 남긴다
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.about_block_create',
        targetType: 'about_block',
        targetId: (created as BlockRow).id,
        detail: { title: data.title, description: summarizeForLog(clean.description), imageCount: data.images.length },
      })
    }
  }

  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok', created: created as BlockRow }
}

/** 콘텐츠 블록 수정 — 전/후를 감사 기록에 남긴다(설명은 요약) */
export async function updateBlock(id: string, data: BlockData): Promise<AdminActionResult> {
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()
  // 설명은 리치 HTML — 저장 시점에 서버측 sanitize(제품 설명과 동일 규칙)
  const clean = { ...data, description: sanitizeRichHtml(data.description) }

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  let before: { title?: string; description?: string; images?: string[] } | null = null
  try {
    const { data: b } = await c.from('front_about_blocks').select('title, description, images').eq('id', id).maybeSingle()
    before = b ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await c.from('front_about_blocks').update(clean).eq('id', id)
  if (error) return dbFailure('블록 수정', error)

  // 감사 기록 — 제목은 전/후 그대로, 설명(리치 HTML)은 요약, 이미지는 수만
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.about_block_update',
        targetType: 'about_block',
        targetId: id,
        detail: {
          from: before
            ? { title: before.title, description: summarizeForLog(before.description ?? ''), imageCount: (before.images ?? []).length }
            : null,
          to: { title: data.title, description: summarizeForLog(clean.description), imageCount: data.images.length },
        },
      })
    }
  }

  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok' }
}

/** 콘텐츠 블록 삭제 — 지우기 전 제목·설명 요약을 감사 기록에 남긴다 */
export async function deleteBlock(id: string): Promise<AdminActionResult> {
  const denied = await guardAdmin()
  if (denied) return denied
  const c = createAdminClient()

  // 감사 기록용 — 지우기 전에 무엇이었는지 확보(조회 실패해도 삭제는 진행)
  let before: { title?: string; description?: string } | null = null
  try {
    const { data: b } = await c.from('front_about_blocks').select('title, description').eq('id', id).maybeSingle()
    before = b ?? null
  } catch { /* 전값 없이 기록 */ }

  const { error } = await c.from('front_about_blocks').delete().eq('id', id)
  if (error) return dbFailure('블록 삭제', error)

  // 감사 기록 — 삭제된 블록의 제목과 설명 요약
  {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.about_block_delete',
        targetType: 'about_block',
        targetId: id,
        detail: { title: before?.title ?? null, description: summarizeForLog(before?.description ?? '') },
      })
    }
  }

  revalidatePath('/admin/content/about')
  revalidatePath('/about')
  return { status: 'ok' }
}
