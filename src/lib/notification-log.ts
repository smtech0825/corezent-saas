/**
 * @파일: lib/notification-log.ts
 * @설명: 이메일 발송·웹훅 처리 결과를 notification_logs에 기록하는 best-effort 헬퍼.
 *        기록 자체는 절대 throw하지 않는다(테이블 미적용·DB 오류가 주 흐름을 깨지 않도록).
 *        서버 전용(createAdminClient) — 웹훅 라우트·lib/email.ts에서 호출.
 */

import { createAdminClient } from './supabase/admin'

export type NotificationKind = 'email' | 'webhook'
export type NotificationStatus = 'success' | 'failure'

/**
 * @함수명: logNotification
 * @설명: 알림(이메일/웹훅) 처리 결과 한 건을 기록합니다. 실패해도 조용히 넘어갑니다.
 * @매개변수: entry - kind/status와 선택적 event·target·error
 * @반환값: 없음(항상 resolve)
 */
export async function logNotification(entry: {
  kind: NotificationKind
  status: NotificationStatus
  event?: string | null
  target?: string | null
  error?: string | null
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('notification_logs').insert({
      kind:   entry.kind,
      status: entry.status,
      event:  entry.event ?? null,
      target: entry.target ?? null,
      // 오류 메시지는 과도하게 길지 않게 잘라 저장
      error:  entry.error ? String(entry.error).slice(0, 1000) : null,
    })
  } catch {
    // best-effort — 기록 실패는 무시(테이블 미적용/DB 오류 등)
  }
}
