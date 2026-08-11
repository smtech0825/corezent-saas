'use client'

/**
 * @파일: admin/_lib/runAdminAction.ts
 * @설명: 관리자 화면에서 서버 기능을 부를 때 쓰는 공용 실행기.
 *        서버 기능은 실패를 결과값(AdminActionResult)으로 돌려준다. 이 실행기는 그 값을 받아
 *        실패면 한국어 사유를 알리고, 값을 그대로 화면에 넘겨준다. 화면은 status === 'ok'일
 *        때만 상태를 바꾸면 되므로 "실패했는데 성공한 것처럼 보이는" 상황이 생기지 않는다.
 *
 *        ★ 서버 예외 문구를 화면에 붙이지 않는다 — 운영 배포본에서는 그 문구가 영문 안내문으로
 *        바뀌어 전달되기 때문이다. 결과값을 못 받은 경우(연결 끊김 등)도 한국어 안내로 바꾼다.
 *
 *        alert를 쓰므로 브라우저 전용이다(현재 부르는 곳은 관리자 콘텐츠 화면 8개 파일).
 */

import type { AdminActionResult } from './adminActionResult'

/**
 * @함수명: runAdminAction
 * @설명: 서버 기능을 실행하고, 실패하면 한국어 사유를 관리자에게 알린 뒤 결과값을 돌려줍니다.
 *        예외를 밖으로 던지지 않으므로 화면이 "처리 중"에 갇히지 않습니다.
 * @매개변수: label - 알림에 넣을 동작 이름(예: 'FAQ 수정') / fn - 실행할 서버 기능
 * @반환값: 서버가 돌려준 결과값. 결과값을 받지 못하면 failed 결과로 바꿔 돌려줍니다.
 */
export async function runAdminAction<T>(
  label: string,
  fn: () => Promise<AdminActionResult<T>>,
): Promise<AdminActionResult<T>> {
  let result: AdminActionResult<T>

  try {
    result = await fn()
  } catch (err) {
    // 결과값 자체를 받지 못한 경우 — 연결 끊김·서버 오류 등. 예외 문구는 붙이지 않는다.
    console.error(`[admin] ${label} 요청 실패:`, err)
    result = {
      status: 'failed',
      reason: `${label} 요청을 보내지 못했습니다. 인터넷 연결과 로그인 상태를 확인한 뒤 다시 시도해 주세요.`,
    }
  }

  if (result.status !== 'ok') alert(result.reason)
  return result
}
