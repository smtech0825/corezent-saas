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
