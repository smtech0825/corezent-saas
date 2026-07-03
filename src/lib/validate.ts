/**
 * @파일: lib/validate.ts
 * @설명: 서버측 입력 검증 유틸리티 (zod 미사용 — 버전 고정 규칙에 따라 수동 검증으로 통일)
 *        관리자 API 라우트·서버 액션의 뮤테이션 입력을 공통 함수로 검증한다.
 */

/**
 * @함수명: isNonEmptyString
 * @설명: 값이 공백 제거 후 1자 이상인 문자열인지 검사한다.
 * @매개변수: v - 검사 대상 값, max - 허용 최대 길이(기본 10000)
 * @반환값: 조건 충족 시 true
 */
export function isNonEmptyString(v: unknown, max = 10000): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max
}

/**
 * @함수명: isPositiveNumber
 * @설명: 값이 유한한 0 초과 숫자인지 검사한다(가격 등). 문자열 숫자는 사전에 parseFloat 후 전달.
 * @매개변수: v - 검사 대상 값
 * @반환값: 양수면 true
 */
export function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

/**
 * @함수명: isNumericIdString
 * @설명: LS variant_id처럼 "숫자로만 이루어진 문자열"인지 검사한다(빈 문자열 허용 안 함).
 * @매개변수: v - 검사 대상 값
 * @반환값: 숫자 문자열이면 true
 */
export function isNumericIdString(v: unknown): v is string {
  return typeof v === 'string' && /^\d+$/.test(v)
}

/**
 * @함수명: isOneOf
 * @설명: 값이 허용 목록에 포함된 문자열인지 검사한다(category·interval·status 등 열거형).
 * @매개변수: v - 검사 대상 값, allowed - 허용 값 배열
 * @반환값: 포함되면 true
 */
export function isOneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
}
