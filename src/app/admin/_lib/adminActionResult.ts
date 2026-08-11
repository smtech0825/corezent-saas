/**
 * @파일: admin/_lib/adminActionResult.ts
 * @설명: 관리자 콘텐츠 서버 기능이 결과를 알리는 공통 규격.
 *        고객지원 답변(admin/support/[id]/ReplyForm.tsx의 ReplyResult)과 같은 모양이다
 *        — status로 갈래를 나누고, 실패면 화면에 그대로 보여줄 한국어 문장을 reason에 담는다.
 *
 *        예외를 쓰지 않는 이유: 운영 배포본에서는 서버가 예외 문구를 감추고 영문 안내문으로
 *        바꿔 보내기 때문에, 관리자가 사유를 알 수 없고 화면에 영문이 노출된다.
 */

import { requireAdminOrThrow } from '@/lib/require-admin'

/**
 * @타입: AdminActionResult
 * @설명: 관리자 서버 기능 결과 세 갈래.
 *        ok = 성공(추가 기능은 만들어진 항목을 created에 담는다)
 *        forbidden = 권한 확인에 걸림 — 다시 로그인해야 한다
 *        failed = 처리 실패(DB 오류 등) — 잠시 후 다시 시도하면 된다
 *        reason에는 한국어 안내만 담는다. DB 오류 원문은 서버 기록에만 남긴다.
 */
export type AdminActionResult<T = null> =
  | { status: 'ok'; created?: T }
  | { status: 'forbidden'; reason: string }
  | { status: 'failed'; reason: string }

/**
 * @함수명: guardAdmin
 * @설명: 관리자 권한을 확인합니다. 통과하면 null을, 막히면 화면에 보여줄 결과값을 돌려줍니다.
 *        기존 requireAdminOrThrow를 그대로 쓰되 예외를 결과값으로 바꿔 줍니다
 *        (권한 확인 자체를 약하게 만들지 않습니다).
 * @반환값: 통과 시 null, 차단 시 forbidden 결과
 */
export async function guardAdmin(): Promise<{ status: 'forbidden'; reason: string } | null> {
  try {
    await requireAdminOrThrow()
    return null
  } catch (err) {
    console.error('[admin] 권한 확인에 걸림:', err instanceof Error ? err.message : String(err))
    return {
      status: 'forbidden',
      reason: '관리자 권한이 확인되지 않았습니다. 로그인이 풀렸을 수 있으니 다시 로그인한 뒤 시도해 주세요.',
    }
  }
}

/**
 * @함수명: dbFailure
 * @설명: DB 오류를 화면에 보여줄 한국어 결과값으로 바꿉니다. 오류 원문은 서버 기록에만 남기고
 *        화면에는 내보내지 않습니다(원문은 영문이고 내부 정보가 섞여 있습니다).
 * @매개변수: label - 동작 이름(예: 'FAQ 수정') / error - Supabase 오류 객체
 * @반환값: failed 결과
 */
export function dbFailure(
  label: string,
  error: { message?: string } | null,
): { status: 'failed'; reason: string } {
  console.error(`[admin] ${label} 실패:`, error?.message ?? '(사유 없음)')
  return {
    status: 'failed',
    reason: `${label}에 실패했습니다. 잠시 후 다시 시도해 주세요. 계속 실패하면 관리자 → 모니터링 로그를 확인해 주세요.`,
  }
}
