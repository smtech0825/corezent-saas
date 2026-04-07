/**
 * @파일: admin/content/hero/page.tsx
 * @설명: Hero 섹션 텍스트 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import HeroEditor from './HeroEditor'

export const dynamic = 'force-dynamic'

const heroKeys = [
  'hero_badge', 'hero_headline1', 'hero_headline2', 'hero_subtext',
  'hero_cta1_text', 'hero_cta1_href', 'hero_cta2_text', 'hero_cta2_href',
]

const defaults: Record<string, string> = {
  hero_badge: 'Software built to make your work easier',
  hero_headline1: 'Powerful Software,',
  hero_headline2: 'Crafted with Care.',
  hero_subtext: 'CoreZent creates and sells thoughtfully-built software — from AI automation tools to productivity apps. Simple pricing, instant activation, and dedicated support.',
  hero_cta1_text: 'Browse products',
  hero_cta1_href: '#product',
  hero_cta2_text: 'Create free account',
  hero_cta2_href: '/auth/register',
}

async function saveHero(data: Record<string, string>) {
  'use server'
  const adminClient = createAdminClient()
  const rows = Object.entries(data).map(([key, value]) => ({
    key: `hero_${key}`,
    value,
    updated_at: new Date().toISOString(),
  }))
  await adminClient
    .from('front_content')
    .upsert(rows, { onConflict: 'key' })
  revalidatePath('/admin/content/hero')
  revalidatePath('/')
}

export default async function HeroAdminPage() {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('front_content')
    .select('key, value')
    .in('key', heroKeys)

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))

  const initial = {
    badge:     map['hero_badge']     ?? defaults['hero_badge'],
    headline1: map['hero_headline1'] ?? defaults['hero_headline1'],
    headline2: map['hero_headline2'] ?? defaults['hero_headline2'],
    subtext:   map['hero_subtext']   ?? defaults['hero_subtext'],
    cta1_text: map['hero_cta1_text'] ?? defaults['hero_cta1_text'],
    cta1_href: map['hero_cta1_href'] ?? defaults['hero_cta1_href'],
    cta2_text: map['hero_cta2_text'] ?? defaults['hero_cta2_text'],
    cta2_href: map['hero_cta2_href'] ?? defaults['hero_cta2_href'],
  }

  async function handleSave(formData: typeof initial) {
    'use server'
    await saveHero(formData)
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Hero Section</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Edit the text content of the landing page hero section.
        </p>
      </div>

      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6">
        <HeroEditor initial={initial} onSave={handleSave} />
      </div>
    </div>
  )
}
