/**
 * @파일: admin/_lib/runAdminAction.ts
 * @설명: 관리자 화면에서 서버 기능을 부를 때 쓰는 공용 실행기.
 *        서버 기능에 권한 확인이 들어가면서 예외가 올라올 수 있게 됐는데, 화면마다
 *        try/catch를 복사해 넣으면 빠뜨리는 곳이 생긴다. 한 곳에서 처리한다.
 *
 *        성공하면 true, 실패하면 false를 돌려준다. 호출부는 true일 때만 화면 상태를
 *        바꾸면 되므로 "실패했는데 성공한 것처럼 보이는" 상황이 생기지 않는다.
 *        알림은 관리자 화면이 이미 쓰고 있는 방식(alert)을 그대로 쓴다.
 */

/**
 * @함수명: runAdminAction
 * @설명: 서버 기능을 실행하고, 실패하면 관리자에게 알린 뒤 false를 돌려줍니다.
 *        예외를 밖으로 던지지 않으므로 화면이 "처리 중"에 갇히지 않습니다.
 * @매개변수: label - 실패 알림에 넣을 동작 이름 (예: 'FAQ 수정')
 * @매개변수: fn - 실행할 서버 기능
 * @반환값: 성공하면 true, 실패하면 false
 */
export async function runAdminAction(label: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn()
    return true
  } catch (err) {
    console.error(`[admin] ${label} 실패:`, err)
    const detail = err instanceof Error && err.message ? `\n${err.message}` : ''
    alert(`${label}에 실패했습니다. 로그인 상태를 확인하고 다시 시도해 주세요.${detail}`)
    return false
  }
}
