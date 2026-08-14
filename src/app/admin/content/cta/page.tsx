/**
 * @파일: admin/content/cta/page.tsx
 * @설명: CTA 섹션 텍스트 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import CtaEditor from './CtaEditor'
import PageContainer from '@/components/common/PageContainer'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { CTA_DEFAULTS } from '@/lib/front-defaults'
import { logAdminActivity, summarizeForLog, currentUserIdForLog } from '@/lib/adminActivityLog'

export const dynamic = 'force-dynamic'

const ctaKeys = [
  'cta_eyebrow', 'cta_headline', 'cta_subtext',
  'cta_btn1_text', 'cta_btn1_href', 'cta_btn2_text', 'cta_btn2_href', 'cta_footnote',
]

// 초기값(예비값)은 공개 화면과 같은 단일 출처(lib/front-defaults.ts)를 쓴다.
// 별도 영문 사본을 두면 "DB 키 삭제 → 편집기에 영문 표시 → 저장 한 번에 랜딩이
// 영어로 덮이는" 사고가 나므로, 여기서 다른 문구를 정의하지 않는다.

async function saveCta(data: Record<string, string>): Promise<AdminActionResult> {
  'use server'
  const denied = await guardAdmin()
  if (denied) return denied
  const adminClient = createAdminClient()

  // 감사 기록용 전값 — 조회 실패해도 저장은 진행
  const beforeMap = new Map<string, string>()
  try {
    const { data: beforeRows } = await adminClient
      .from('front_content').select('key, value').in('key', ctaKeys)
    ;(beforeRows ?? []).forEach((r) => beforeMap.set(r.key, r.value ?? ''))
  } catch { /* 전값 없이 기록 */ }

  const rows = Object.entries(data).map(([key, value]) => ({
    key: `cta_${key}`,
    value,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await adminClient
    .from('front_content')
    .upsert(rows, { onConflict: 'key' })
  if (error) return dbFailure('CTA 저장', error)

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
        action: 'content.cta_update',
        targetType: 'front_content',
        targetId: 'cta',
        detail: { changed },
      })
    }
  }

  revalidatePath('/admin/content/cta')
  revalidatePath('/')
  return { status: 'ok' }
}

export default async function CtaAdminPage() {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('front_content')
    .select('key, value')
    .in('key', ctaKeys)

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))

  const initial = {
    eyebrow:   map['cta_eyebrow']   ?? CTA_DEFAULTS.eyebrow,
    headline:  map['cta_headline']  ?? CTA_DEFAULTS.headline,
    subtext:   map['cta_subtext']   ?? CTA_DEFAULTS.subtext,
    btn1_text: map['cta_btn1_text'] ?? CTA_DEFAULTS.btn1_text,
    btn1_href: map['cta_btn1_href'] ?? CTA_DEFAULTS.btn1_href,
    btn2_text: map['cta_btn2_text'] ?? CTA_DEFAULTS.btn2_text,
    btn2_href: map['cta_btn2_href'] ?? CTA_DEFAULTS.btn2_href,
    footnote:  map['cta_footnote']  ?? CTA_DEFAULTS.footnote,
  }

  async function handleSave(formData: typeof initial): Promise<AdminActionResult> {
    'use server'
    const denied = await guardAdmin()
    if (denied) return denied
    return saveCta(formData)
  }

  return (
    <PageContainer variant="admin-form" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-ink">CTA 섹션</h1>
        <p className="text-sm text-ink-soft mt-1">
          하단 CTA(행동 유도) 섹션의 텍스트 콘텐츠를 편집합니다.
        </p>
      </div>

      <div className="border border-rule bg-paper-raised rounded-card p-6">
        <CtaEditor initial={initial} onSave={handleSave} />
      </div>
    </PageContainer>
  )
}
