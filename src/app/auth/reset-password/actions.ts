'use server'

/**
 * @파일: reset-password/actions.ts
 * @설명: 비밀번호 재설정 관련 서버 액션
 *        admin client로 auth.users에서 이메일 존재 여부 확인
 */

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * @함수: checkEmailRegistered
 * @설명: 이메일이 가입된 계정인지 확인
 * @반환값: true = 가입된 이메일, false = 미가입
 */
export async function checkEmailRegistered(email: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    return (data?.users ?? []).some(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    )
  } catch {
    return false
  }
}
