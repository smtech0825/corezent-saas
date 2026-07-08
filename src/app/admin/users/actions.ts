'use server'

/**
 * @파일: admin/users/actions.ts
 * @설명: 관리자 사용자 관리 서버 액션
 *        - changeRole: 역할 변경 (user / admin)
 *        - withdrawUser: 탈퇴 처리 (status=inactive + Supabase ban)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrThrow } from '@/lib/require-admin'
import { revalidatePath } from 'next/cache'
import { logAdminActivity } from '@/lib/adminActivityLog'

/** 역할 변경 */
export async function changeRole(userId: string, newRole: string) {
  const actorId = await requireAdminOrThrow()
  if (!userId || !newRole) return
  const adminClient = createAdminClient()

  const { data: before } = await adminClient.from('profiles').select('role').eq('id', userId).single()
  await adminClient.from('profiles').update({ role: newRole }).eq('id', userId)

  await logAdminActivity({
    adminUserId: actorId,
    action: 'user.role_change',
    targetType: 'user',
    targetId: userId,
    detail: { from: before?.role ?? null, to: newRole },
  })

  revalidatePath('/admin/users')
}

/** 탈퇴 처리 — 소프트 삭제 (데이터 보존 + 로그인 차단) */
export async function withdrawUser(userId: string): Promise<{ error?: string }> {
  const actorId = await requireAdminOrThrow()
  if (!userId) return { error: 'Invalid user ID' }
  const adminClient = createAdminClient()

  // 1. profiles.status = 'inactive' 업데이트
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ status: 'inactive' })
    .eq('id', userId)

  if (profileError) return { error: profileError.message }

  // 2. Supabase Auth 차원 로그인 차단 (100년 ban)
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  })

  if (authError) return { error: authError.message }

  await logAdminActivity({
    adminUserId: actorId,
    action: 'user.withdraw',
    targetType: 'user',
    targetId: userId,
  })

  revalidatePath('/admin/users')
  return {}
}
