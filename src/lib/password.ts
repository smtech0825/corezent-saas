/**
 * @파일: lib/password.ts
 * @설명: 비밀번호 규칙 단일 출처 — 회원가입·비밀번호 재설정·설정 화면의 비밀번호 변경이 모두 이것을 쓴다.
 *        규칙이 화면마다 갈라지면 한 곳에서만 약한 비밀번호가 통과한다(같은 계정을 지키는 문 세 개 중 하나가 열린 셈).
 *
 *        규칙(운영자 결정): 8자 이상 + 영문과 숫자를 섞어서.
 *        기호는 요구하지 않는다 — 못 외워 더 약한 비밀번호를 쓰게 되는 쪽이 더 위험하다.
 */

/** 최소 길이 */
const MIN_LENGTH = 8

/** 화면에 보여 줄 안내 — 무엇이 필요한지 그대로 적는다(입력칸 아래 설명·오류 문구 공용) */
export const PASSWORD_RULE_TEXT = '8자 이상, 영문과 숫자를 함께 사용해 주세요.'

/**
 * @함수명: validatePassword
 * @설명: 비밀번호가 규칙을 지키는지 검사합니다.
 * @매개변수: password - 사용자가 입력한 비밀번호
 * @반환값: 문제가 없으면 null, 있으면 화면에 그대로 보여 줄 한국어 안내 문구
 */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다. ${PASSWORD_RULE_TEXT}`
  }
  const hasLetter = /[A-Za-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  if (!hasLetter || !hasNumber) {
    return `비밀번호에 영문과 숫자를 함께 넣어 주세요. ${PASSWORD_RULE_TEXT}`
  }
  return null
}
