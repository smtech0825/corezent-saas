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

/** 목록 화면이 허용하는 최대 페이지 번호 — 터무니없이 큰 값으로 조회를 시키지 않기 위한 상한 */
const MAX_PAGE = 100_000

/**
 * @함수명: parsePageParam
 * @설명: 주소창의 page 값을 목록 페이지 번호로 바꾼다. 숫자가 아니거나(?page=abc) 범위를
 *        벗어난 값(0·음수·소수점·너무 큰 수)이 들어와도 목록이 통째로 안 뜨는 일이 없도록
 *        1 이상 MAX_PAGE 이하의 정수로 맞춘다. 해석할 수 없으면 첫 페이지로 본다.
 * @매개변수: raw - 주소에서 읽은 page 값(없거나 배열일 수 있음)
 * @반환값: 1 이상 MAX_PAGE 이하의 정수
 */
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === undefined || value === null || String(value).trim() === '') return 1
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  const page = Math.floor(parsed)
  if (page < 1) return 1
  return Math.min(page, MAX_PAGE)
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
