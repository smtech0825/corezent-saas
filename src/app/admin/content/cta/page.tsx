/**
 * @파일: admin/content/cta/page.tsx
 * @설명: CTA 섹션 텍스트 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import CtaEditor from './CtaEditor'

export const dynamic = 'force-dynamic'

const ctaKeys = [
  'cta_eyebrow', 'cta_headline', 'cta_subtext',
  'cta_btn1_text', 'cta_btn1_href', 'cta_btn2_text', 'cta_btn2_href', 'cta_footnote',
]

const defaults: Record<string, string> = {
  cta_eyebrow:   'Get started today',
  cta_headline:  'Find the right tool for your work.',
  cta_subtext:   'Explore our products, pick what fits, and get instant access. Built by developers who care about quality.',
  cta_btn1_text: 'Browse products',
  cta_btn1_href: '#product',
  cta_btn2_text: 'Create free account →',
  cta_btn2_href: '/auth/register',
  cta_footnote:  'No credit card required · Instant activation',
}

async function saveCta(data: Record<string, string>) {
  'use server'
  const adminClient = createAdminClient()
  const rows = Object.entries(data).map(([key, value]) => ({
    key: `cta_${key}`,
    value,
    updated_at: new Date().toISOString(),
  }))
  await adminClient
    .from('front_content')
    .upsert(rows, { onConflict: 'key' })
  revalidatePath('/admin/content/cta')
  revalidatePath('/')
}

export default async function CtaAdminPage() {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('front_content')
    .select('key, value')
    .in('key', ctaKeys)

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))

  const initial = {
    eyebrow:   map['cta_eyebrow']   ?? defaults['cta_eyebrow'],
    headline:  map['cta_headline']  ?? defaults['cta_headline'],
    subtext:   map['cta_subtext']   ?? defaults['cta_subtext'],
    btn1_text: map['cta_btn1_text'] ?? defaults['cta_btn1_text'],
    btn1_href: map['cta_btn1_href'] ?? defaults['cta_btn1_href'],
    btn2_text: map['cta_btn2_text'] ?? defaults['cta_btn2_text'],
    btn2_href: map['cta_btn2_href'] ?? defaults['cta_btn2_href'],
    footnote:  map['cta_footnote']  ?? defaults['cta_footnote'],
  }

  async function handleSave(formData: typeof initial) {
    'use server'
    await saveCta(formData)
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-serif text-ink">CTA 섹션</h1>
        <p className="text-sm text-ink-soft mt-1">
          하단 CTA(행동 유도) 섹션의 텍스트 콘텐츠를 편집합니다.
        </p>
      </div>

      <div className="border border-rule bg-paper-raised rounded-2xl p-6">
        <CtaEditor initial={initial} onSave={handleSave} />
      </div>
    </div>
  )
}
