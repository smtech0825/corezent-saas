'use server'

/**
 * @파일: dashboard/billing/download-actions.ts
 * @설명: 다운로드 버전 기록 서버 액션 — 사용자 라이선스에 last_downloaded_version 업데이트
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/** 사용자가 특정 상품을 다운로드했을 때 last_downloaded_version 업데이트 */
export async function markDownloaded(productId: string, version: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  await admin
    .from('licenses')
    .update({ last_downloaded_version: version })
    .eq('user_id', user.id)
    .eq('product_id', productId)
}
