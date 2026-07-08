/**
 * @파일: lib/mask.ts
 * @설명: 로그에 민감정보(라이선스 키 등)를 남길 때 앞부분만 보이고 나머지는 마스킹하는 유틸.
 */

/**
 * @함수명: maskSecret
 * @설명: 문자열 앞 visible자만 남기고 나머지를 '*'로 마스킹합니다.
 * @매개변수: value - 마스킹할 원본 문자열 / visible - 앞에 남길 글자 수(기본 4)
 * @반환값: 마스킹된 문자열 (원본 길이 유지)
 */
export function maskSecret(value: string, visible = 4): string {
  if (!value) return value
  if (value.length <= visible) return '*'.repeat(value.length)
  return value.slice(0, visible) + '*'.repeat(Math.max(value.length - visible, 4))
}

/**
 * @함수명: maskPgUniqueViolation
 * @설명: Postgres UNIQUE 제약 위반(SQLSTATE 23505)은 detail에 실제 컬럼값을 그대로 담아
 *        반환한다(예: "Key (license_key)=(ABCD-1234-...) already exists."). 이 코드일 때만
 *        message/details에서 그 값을 마스킹한 사본을 반환하고, 그 외 에러는 그대로 반환한다.
 * @매개변수: error - 로그로 남기려는 에러(Supabase/Postgres 에러 객체 또는 임의 값)
 * @반환값: 23505가 아니면 원본 그대로, 23505면 값이 마스킹된 사본
 */
export function maskPgUniqueViolation(error: unknown): unknown {
  if (!error || typeof error !== 'object') return error
  const e = error as { code?: string; message?: unknown; details?: unknown }
  if (e.code !== '23505') return error

  const scrub = (s: unknown) =>
    typeof s === 'string'
      ? s.replace(/=\(([^)]*)\)/, (_m, val: string) => `=(${maskSecret(val, 4)})`)
      : s

  return { ...e, message: scrub(e.message), details: scrub(e.details) }
}
