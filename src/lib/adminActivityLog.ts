/**
 * @파일: lib/adminActivityLog.ts
 * @설명: 관리자의 민감한 작업(라이선스 회수·환불·역할 변경 등)을 admin_activity_log에
 *        기록하는 공용 헬퍼. lib/notification-log.ts와 동일하게 best-effort — 기록 실패가
 *        원래 작업(라이선스 회수 자체 등)을 막아서는 안 되므로 항상 조용히 넘어간다.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface AdminActivityLogParams {
  adminUserId: string
  action: string
  targetType: string
  targetId: string
  detail?: Record<string, unknown>
}

/**
 * @함수명: logAdminActivity
 * @설명: 관리자 활동 로그 한 건을 기록합니다. 실패해도 조용히 넘어갑니다.
 * @매개변수: params - adminUserId/action/targetType/targetId/detail
 * @반환값: 없음(항상 resolve)
 */
export async function logAdminActivity(params: AdminActivityLogParams): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('admin_activity_log').insert({
      admin_user_id: params.adminUserId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      detail: params.detail ?? null,
    })
  } catch {
    // best-effort — 기록 실패는 무시(테이블 미적용/DB 오류 등)
  }
}
