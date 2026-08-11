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
  // 실패는 조용히 넘기지 않는다 — 화면이 "바뀐 것처럼" 보이면 관리자가 잘못 알게 된다.
  if (!userId || !newRole) throw new Error('역할 변경 실패: 대상 또는 역할 값이 비어 있습니다.')
  const adminClient = createAdminClient()

  const { data: before } = await adminClient.from('profiles').select('role').eq('id', userId).single()
  const { error: updateError } = await adminClient.from('profiles').update({ role: newRole }).eq('id', userId)
  if (updateError) throw new Error(`역할 변경 실패: ${updateError.message}`)

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
  if (!userId) return { error: '대상 회원을 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.' }
  const adminClient = createAdminClient()

  // 1. profiles.status = 'inactive' 업데이트
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ status: 'inactive' })
    .eq('id', userId)

  if (profileError) {
    // 원문은 영문이라 화면에 내보내지 않는다. 사유는 서버 기록에만 남긴다.
    console.error('[users] 탈퇴 처리 실패(회원 상태):', profileError.message)
    return { error: '회원 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  // 2. Supabase Auth 차원 로그인 차단 (100년 ban)
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  })

  if (authError) {
    console.error('[users] 탈퇴 처리 실패(로그인 차단):', authError.message)
    return { error: '회원 상태는 바뀌었지만 로그인 차단에 실패했습니다. 목록을 확인한 뒤 다시 시도해 주세요.' }
  }

  await logAdminActivity({
    adminUserId: actorId,
    action: 'user.withdraw',
    targetType: 'user',
    targetId: userId,
  })

  revalidatePath('/admin/users')
  return {}
}
