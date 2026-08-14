/**
 * @파일: lib/adminActivityLog.ts
 * @설명: 관리자의 민감한 작업(라이선스 회수·환불·역할 변경 등)을 admin_activity_log에
 *        기록하는 공용 헬퍼. lib/notification-log.ts와 동일하게 best-effort — 기록 실패가
 *        원래 작업(라이선스 회수 자체 등)을 막아서는 안 되므로 항상 조용히 넘어간다.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export interface AdminActivityLogParams {
  adminUserId: string
  action: string
  targetType: string
  targetId: string
  detail?: Record<string, unknown>
}

/**
 * @함수명: summarizeForLog
 * @설명: 긴 문구(콘텐츠·설명 등)를 기록용으로 요약합니다 — 앞부분 일부와 전체 글자 수만.
 *        전문을 남기면 기록이 감당 못 하게 커지고 개인정보·비밀값이 딸려 들어갈 수 있어,
 *        긴 값은 반드시 이 요약으로만 기록합니다(짧은 값(가격·상태·순서)은 전/후 그대로).
 * @매개변수: text - 원문(문자열이 아니면 문자열화) / max - 남길 앞부분 길이(기본 80자)
 * @반환값: { preview, length } 또는 값이 없으면 null
 */
export function summarizeForLog(text: unknown, max = 80): { preview: string; length: number } | null {
  if (text == null) return null
  const s = String(text)
  return { preview: s.slice(0, max), length: s.length }
}

/**
 * @함수명: currentUserIdForLog
 * @설명: 기록에 남길 현재 로그인 사용자 id를 best-effort로 조회합니다.
 *        권한 확인용이 아닙니다 — 권한은 각 기능의 가드(guardAdmin 등)가 이미 확인한 뒤에만
 *        부릅니다. 확인이 안 되면 null을 돌려주고, 그 경우 기록은 남기지 않습니다
 *        (주인 없는 기록을 만들지 않기 위함 — 기록 실패가 본 작업을 막지도 않습니다).
 * @반환값: 사용자 id 또는 확인 불가 시 null
 */
export async function currentUserIdForLog(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
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
    const { error } = await admin.from('admin_activity_log').insert({
      admin_user_id: params.adminUserId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      detail: params.detail ?? null,
    })
    // Supabase는 DB 오류를 throw하지 않고 error로 돌려준다 — 유실을 완전 무음으로 두면
    // 아무도 모르므로 서버 기록(Vercel 로그)에는 남긴다. 본 작업은 계속 막지 않는다.
    if (error) console.error('[adminActivityLog] 기록 실패(본 작업은 정상):', params.action, error.message)
  } catch (err) {
    console.error('[adminActivityLog] 기록 실패(본 작업은 정상):', params.action, err instanceof Error ? err.message : String(err))
  }
}
