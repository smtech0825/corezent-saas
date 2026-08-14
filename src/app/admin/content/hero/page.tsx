/**
 * @파일: admin/content/hero/page.tsx
 * @설명: Hero 섹션 텍스트 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import HeroEditor from './HeroEditor'
import PageContainer from '@/components/common/PageContainer'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { HERO_DEFAULTS } from '@/lib/front-defaults'
import { logAdminActivity, summarizeForLog, currentUserIdForLog } from '@/lib/adminActivityLog'

export const dynamic = 'force-dynamic'

const heroKeys = [
  'hero_badge', 'hero_headline1', 'hero_headline2', 'hero_subtext',
  'hero_cta1_text', 'hero_cta1_href', 'hero_cta2_text', 'hero_cta2_href',
]

// 초기값(예비값)은 공개 화면과 같은 단일 출처(lib/front-defaults.ts)를 쓴다.
// 별도 영문 사본을 두면 "DB 키 삭제 → 편집기에 영문 표시 → 저장 한 번에 랜딩이
// 영어로 덮이는" 사고가 나므로, 여기서 다른 문구를 정의하지 않는다.

async function saveHero(data: Record<string, string>): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  const beforeMap = new Map<string, string>()
  try {
    const { data: beforeRows } = await adminClient
      .from('front_content').select('key, value').in('key', heroKeys)
    ;(beforeRows ?? []).forEach((r) => beforeMap.set(r.key, r.value ?? ''))
  } catch { /* 전값 없이 기록 */ }

  const rows = Object.entries(data).map(([key, value]) => ({
    key: `hero_${key}`,
    value,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await adminClient
    .from('front_content')
    .upsert(rows, { onConflict: 'key' })
  if (error) return dbFailure('히어로 저장', error)

  // 감사 기록 — 실제로 바뀐 키만(짧은 값은 전/후 그대로, 긴 값은 앞부분+글자 수 요약)
  const changed = rows
    .filter((r) => (beforeMap.get(r.key) ?? '') !== r.value)
    .map((r) => {
      const from = beforeMap.get(r.key) ?? ''
      return from.length <= 80 && r.value.length <= 80
        ? { key: r.key, from, to: r.value }
        : { key: r.key, from: summarizeForLog(from), to: summarizeForLog(r.value) }
    })
  if (changed.length > 0) {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'content.hero_update',
        targetType: 'front_content',
        targetId: 'hero',
        detail: { changed },
      })
    }
  }

  revalidatePath('/admin/content/hero')
  revalidatePath('/')
  return { status: 'ok' }
}

export default async function HeroAdminPage() {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('front_content')
    .select('key, value')
    .in('key', heroKeys)

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))

  const initial = {
    badge:     map['hero_badge']     ?? HERO_DEFAULTS.badge,
    headline1: map['hero_headline1'] ?? HERO_DEFAULTS.headline1,
    headline2: map['hero_headline2'] ?? HERO_DEFAULTS.headline2,
    subtext:   map['hero_subtext']   ?? HERO_DEFAULTS.subtext,
    cta1_text: map['hero_cta1_text'] ?? HERO_DEFAULTS.cta1_text,
    cta1_href: map['hero_cta1_href'] ?? HERO_DEFAULTS.cta1_href,
    cta2_text: map['hero_cta2_text'] ?? HERO_DEFAULTS.cta2_text,
    cta2_href: map['hero_cta2_href'] ?? HERO_DEFAULTS.cta2_href,
  }

  async function handleSave(formData: typeof initial): Promise<AdminActionResult> {
    'use server'
    const denied = await guardAdmin()
    if (denied) return denied
    return saveHero(formData)
  }

  return (
    <PageContainer variant="admin-form" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">히어로 섹션</h1>
        <p className="text-sm text-ink-soft mt-1">
          랜딩 페이지 히어로 섹션의 텍스트 콘텐츠를 편집합니다.
        </p>
      </div>

      <div className="border border-rule bg-paper-raised rounded-card p-6">
        <HeroEditor initial={initial} onSave={handleSave} />
      </div>
    </PageContainer>
  )
}
