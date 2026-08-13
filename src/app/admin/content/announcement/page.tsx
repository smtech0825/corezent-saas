/**
 * @파일: admin/content/announcement/page.tsx
 * @설명: 상단 공지 배너 콘텐츠 관리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import BannerEditor from './BannerEditor'
import PageContainer from '@/components/common/PageContainer'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { BANNER_DEFAULTS } from '@/lib/front-defaults'

export const dynamic = 'force-dynamic'

const bannerKeys = [
  'banner_text', 'banner_text_mobile', 'banner_link_text', 'banner_link_url', 'banner_visible',
]

// 초기값(예비값)은 공개 화면과 같은 단일 출처(lib/front-defaults.ts)를 쓴다.
// 별도 영문 사본을 두면 "DB 키 삭제 → 편집기에 영문 표시 → 저장 한 번에 배너가
// 영어로 덮이는" 사고가 나므로, 여기서 다른 문구를 정의하지 않는다.

export default async function AnnouncementAdminPage() {
  const client = createAdminClient()
  const { data } = await client
    .from('front_content')
    .select('key, value')
    .in('key', bannerKeys)

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))

  const initial = {
    text:        map['banner_text']        ?? BANNER_DEFAULTS.text,
    text_mobile: map['banner_text_mobile'] ?? BANNER_DEFAULTS.text_mobile,
    link_text:   map['banner_link_text']   ?? BANNER_DEFAULTS.link_text,
    link_url:    map['banner_link_url']    ?? BANNER_DEFAULTS.link_url,
    visible:     map['banner_visible']     ?? BANNER_DEFAULTS.visible,
  }

  async function handleSave(formData: typeof initial): Promise<AdminActionResult> {
    'use server'
    const denied = await guardAdmin()
    if (denied) return denied
    const adminClient = createAdminClient()
    const rows = Object.entries(formData).map(([key, value]) => ({
      key: `banner_${key}`,
      value,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await adminClient
      .from('front_content')
      .upsert(rows, { onConflict: 'key' })
    if (error) return dbFailure('배너 저장', error)
    revalidatePath('/admin/content/announcement')
    revalidatePath('/')
    return { status: 'ok' }
  }

  return (
    <PageContainer variant="admin-form" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">공지 배너</h1>
        <p className="text-sm text-ink-soft mt-1">
          내비게이션 위에 표시되는 공지 바를 편집합니다.
        </p>
      </div>

      <div className="border border-rule bg-paper-raised rounded-card p-6">
        <BannerEditor initial={initial} onSave={handleSave} />
      </div>
    </PageContainer>
  )
}
