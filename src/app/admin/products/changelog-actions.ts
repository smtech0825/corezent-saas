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

/**
 * @함수명: isValidHttpUrl
 * @설명: 다운로드 URL이 http/https 형식인지 검증합니다. (외부 접근성까지는 확인하지 않음)
 * @매개변수: value - 검증할 URL 문자열
 * @반환값: http/https URL이면 true
 */
function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Changelog 추가 또는 수정 */
export async function upsertChangelog(
  productId: string,
  data: ChangelogFormData,
  changelogId?: string
): Promise<{ error?: string; id?: string }> {
  const client = createAdminClient()

  // 다운로드 URL: 빈 값 제거 + http/https 형식 검증 (서버가 최종 방어선)
  const cleanedUrls = Object.entries(data.download_urls).filter(([, v]) => v.trim())
  const invalid = cleanedUrls.filter(([, v]) => !isValidHttpUrl(v))
  if (invalid.length > 0) {
    return { error: `다운로드 URL 형식이 올바르지 않습니다 (http/https 필요): ${invalid.map(([k]) => k).join(', ')}` }
  }

  const payload = {
    product_id: productId,
    version: data.version.trim(),
    release_date: data.release_date,
    is_latest: data.is_latest,
    download_urls: Object.fromEntries(
      cleanedUrls.map(([k, v]) => [k, v.trim()])
    ),
    content: {
      new_features:     data.content.new_features.filter(Boolean),
      improvements:     data.content.improvements.filter(Boolean),
      bug_fixes:        data.content.bug_fixes.filter(Boolean),
      breaking_changes: data.content.breaking_changes.filter(Boolean),
    },
  }

  if (changelogId) {
    const { error } = await client.from('changelogs').update(payload).eq('id', changelogId)
    if (error) return { error: error.message }
  } else {
    const { error, data: inserted } = await client
      .from('changelogs')
      .insert(payload)
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath('/admin/products')
    revalidatePath('/changelog')
    return { id: inserted?.id as string }
  }

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
