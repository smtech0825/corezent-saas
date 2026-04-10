/**
 * @파일: admin/settings/page.tsx
 * @설명: 사이트 설정 관리 — 서버 컴포넌트에서 초기 데이터를 fetch해 SettingsClient에 전달
 */

import { createAdminClient } from '@/lib/supabase/admin'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const adminClient = createAdminClient()

  const { data: rows } = await adminClient
    .from('front_settings')
    .select('key, value')

  const initial = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value ?? '']))

  return <SettingsClient initial={initial} />
}
