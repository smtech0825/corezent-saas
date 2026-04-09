'use server'

/**
 * @파일: admin/products/changelog-actions.ts
 * @설명: Changelog CRUD 서버 액션 — 관리자 전용
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface ChangelogContent {
  new_features: string[]
  improvements: string[]
  bug_fixes: string[]
  breaking_changes: string[]
}

export interface ChangelogFormData {
  version: string
  release_date: string
  is_latest: boolean
  download_urls: Record<string, string>
  content: ChangelogContent
}

/** Changelog 추가 또는 수정 */
export async function upsertChangelog(
  productId: string,
  data: ChangelogFormData,
  changelogId?: string
): Promise<{ error?: string }> {
  const client = createAdminClient()

  const payload = {
    product_id: productId,
    version: data.version.trim(),
    release_date: data.release_date,
    is_latest: data.is_latest,
    download_urls: Object.fromEntries(
      Object.entries(data.download_urls).filter(([, v]) => v.trim())
    ),
    content: {
      new_features:     data.content.new_features.filter(Boolean),
      improvements:     data.content.improvements.filter(Boolean),
      bug_fixes:        data.content.bug_fixes.filter(Boolean),
      breaking_changes: data.content.breaking_changes.filter(Boolean),
    },
  }

  let error
  if (changelogId) {
    ;({ error } = await client.from('changelogs').update(payload).eq('id', changelogId))
  } else {
    ;({ error } = await client.from('changelogs').insert(payload))
  }

  if (error) return { error: error.message }

  revalidatePath('/admin/products')
  revalidatePath('/changelog')
  return {}
}

/** Changelog 삭제 */
export async function deleteChangelog(changelogId: string): Promise<{ error?: string }> {
  const client = createAdminClient()
  const { error } = await client.from('changelogs').delete().eq('id', changelogId)
  if (error) return { error: error.message }

  revalidatePath('/admin/products')
  revalidatePath('/changelog')
  return {}
}
