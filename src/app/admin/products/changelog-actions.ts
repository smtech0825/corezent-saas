'use server'

/**
 * @파일: admin/products/changelog-actions.ts
 * @설명: Changelog CRUD 서버 액션 — 관리자 전용
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrThrow } from '@/lib/require-admin'
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

/**
 * @함수명: unsetOtherLatest
 * @설명: 방금 저장한 항목을 "최신"으로 켰다면, 같은 제품의 다른 항목에서 최신 표시를 끈다.
 *        제품 하나에 최신이 둘 이상 켜져 있으면 화면이 어느 쪽을 고를지 알 수 없기 때문이다.
 *        product_id로 범위를 좁히므로 다른 제품의 최신 표시는 건드리지 않는다.
 *        기존 데이터를 일괄 정리하지는 않는다 — 저장하는 시점부터 적용된다.
 * @매개변수: client - service role 클라이언트 / productId - 대상 제품 / isLatest - 이번에 켰는지
 *            keepId - 방금 저장한 항목 id(이건 켠 채로 둔다)
 * @반환값: 없음(실패해도 저장 자체는 성공으로 둔다)
 */
async function unsetOtherLatest(
  client: ReturnType<typeof createAdminClient>,
  productId: string,
  isLatest: boolean,
  keepId?: string,
): Promise<void> {
  if (!isLatest || !keepId) return
  const { error } = await client
    .from('changelogs')
    .update({ is_latest: false })
    .eq('product_id', productId)
    .eq('is_latest', true)
    .neq('id', keepId)
  if (error) {
    // 저장은 이미 끝났다. 여기서 실패해도 되돌리지 않고 로그만 남긴다.
    console.error('[changelog] 이전 최신 표시 해제 실패:', error.message)
  }
}

/** Changelog 추가 또는 수정 */
export async function upsertChangelog(
  productId: string,
  data: ChangelogFormData,
  changelogId?: string
): Promise<{ error?: string; id?: string }> {
  await requireAdminOrThrow()
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
    if (error) {
      // 원문은 영문이라 화면에 내보내지 않는다. 사유는 서버 기록에만 남긴다.
      console.error('[changelog] 수정 실패:', error.message)
      return { error: '변경 이력을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.' }
    }
    await unsetOtherLatest(client, productId, data.is_latest, changelogId)
  } else {
    const { error, data: inserted } = await client
      .from('changelogs')
      .insert(payload)
      .select('id')
      .single()
    if (error) {
      console.error('[changelog] 추가 실패:', error.message)
      return { error: '변경 이력을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.' }
    }
    await unsetOtherLatest(client, productId, data.is_latest, inserted?.id as string | undefined)
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
  await requireAdminOrThrow()
  const client = createAdminClient()
  const { error } = await client.from('changelogs').delete().eq('id', changelogId)
  if (error) {
    console.error('[changelog] 삭제 실패:', error.message)
    return { error: '변경 이력을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  revalidatePath('/admin/products')
  revalidatePath('/changelog')
  return {}
}
