/**
 * @파일: admin/content/announcement/page.tsx
 * @설명: 상단 공지 배너 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import BannerEditor from './BannerEditor'

export const dynamic = 'force-dynamic'

const bannerKeys = [
  'banner_text', 'banner_text_mobile', 'banner_link_text', 'banner_link_url', 'banner_visible',
]

const defaults: Record<string, string> = {
  banner_text: 'Introducing GeniePost — AI-powered WordPress posting, starting at $9/month.',
  banner_text_mobile: 'GeniePost is here — AI WordPress posting from $9/mo.',
  banner_link_text: 'Learn more →',
  banner_link_url: '#product',
  banner_visible: 'true',
}

export default async function AnnouncementAdminPage() {
  const client = createAdminClient()
  const { data } = await client
    .from('front_content')
    .select('key, value')
    .in('key', bannerKeys)

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))

  const initial = {
    text:        map['banner_text']        ?? defaults['banner_text'],
    text_mobile: map['banner_text_mobile'] ?? defaults['banner_text_mobile'],
    link_text:   map['banner_link_text']   ?? defaults['banner_link_text'],
    link_url:    map['banner_link_url']    ?? defaults['banner_link_url'],
    visible:     map['banner_visible']     ?? defaults['banner_visible'],
  }

  async function handleSave(formData: typeof initial) {
    'use server'
    const adminClient = createAdminClient()
    const rows = Object.entries(formData).map(([key, value]) => ({
      key: `banner_${key}`,
      value,
      updated_at: new Date().toISOString(),
    }))
    await adminClient
      .from('front_content')
      .upsert(rows, { onConflict: 'key' })
    revalidatePath('/admin/content/announcement')
    revalidatePath('/')
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Announcement Banner</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Edit the announcement bar shown above the navigation.
        </p>
      </div>

      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6">
        <BannerEditor initial={initial} onSave={handleSave} />
      </div>
    </div>
  )
}
