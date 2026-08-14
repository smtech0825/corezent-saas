/**
 * @파일: lib/auth-error.ts
 * @설명: Supabase 인증이 돌려준 오류를 "무엇 때문에 실패했는지"로 판정하는 한 곳.
 *        로그인 화면·설정 화면·인증 코드 화면이 같은 판정을 각자 들고 있어, 한쪽만 고치면
 *        화면마다 다르게 판정되는 상태였다. 판정은 여기에만 둔다.
 *
 *        오류 원문(영문)은 판정에만 쓰고 화면에는 내보내지 않는다. 화면 문구는 각 화면이
 *        자기 맥락에 맞게 고른다(같은 판정이라도 로그인·비밀번호 변경·재전송은 할 말이 다르다).
 *
 *        인증 콜백이 주소로 넘기는 실패 종류는 성격이 달라 lib/auth-callback-error.ts에 있다.
 */

/** 비밀번호가 실제로 틀렸을 때만 Supabase가 돌려주는 문장 */
const WRONG_CREDENTIALS = 'Invalid login credentials'

/**
 * @함수명: isWrongPassword
 * @설명: 이메일·비밀번호가 실제로 틀려서 실패한 것인지 판정합니다. 정확히 일치할 때만
 *        참입니다 — 연결 끊김·서버 오류를 "비밀번호가 틀렸다"로 단정하지 않기 위해서입니다.
 * @매개변수: message - Supabase가 돌려준 오류 메시지
 * @반환값: 비밀번호 불일치면 true
 */
export function isWrongPassword(message: string | null | undefined): boolean {
  return (message ?? '') === WRONG_CREDENTIALS
}

/**
 * @함수명: isEmailInUse
 * @설명: 이메일 변경·가입에서 "이미 쓰이고 있는 주소"라서 실패한 것인지 판정합니다.
 *        Supabase는 error.code 'email_exists' 또는 "...already been registered" 문장으로
 *        알려주므로 코드 우선, 문장 보조로 판정합니다.
 * @매개변수: message - Supabase가 돌려준 오류 메시지
 * @매개변수: code - Supabase AuthError의 code (있으면 우선 사용)
 * @반환값: 이미 등록된 주소면 true
 */
export function isEmailInUse(message: string | null | undefined, code?: string | null): boolean {
  if (code === 'email_exists') return true
  const raw = (message ?? '').toLowerCase()
  return raw.includes('already been registered') || raw.includes('already registered')
}

/**
 * @함수명: isRateLimited
 * @설명: 짧은 시간에 너무 자주 요청해서 막힌 것인지 판정합니다.
 *        Supabase는 "Request rate limit reached" 또는 "...you can only request this after N
 *        seconds" 형태로 알려주므로 두 표현을 함께 봅니다.
 * @매개변수: message - Supabase가 돌려준 오류 메시지
 * @반환값: 요청 과다로 막힌 것이면 true
 */
export function isRateLimited(message: string | null | undefined): boolean {
  const raw = (message ?? '').toLowerCase()
  return raw.includes('rate limit') || raw.includes('after')
}
