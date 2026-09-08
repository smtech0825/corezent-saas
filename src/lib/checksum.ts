/**
 * @파일: lib/checksum.ts
 * @설명: 설치파일 SHA-256 체크섬 정규화·검증 단일 출처.
 *        편집기(즉시 피드백)와 서버 액션(최종 방어선)이 같은 규칙을 써야 한다.
 *        규칙이 갈리면 화면에서는 통과한 값이 저장에서 거부되거나 그 반대가 된다.
 */

/** SHA-256 체크섬 형식 — 소문자 16진수 64자리 */
export const SHA256_RE = /^[0-9a-f]{64}$/

/**
 * @함수명: normalizeChecksum
 * @설명: 체크섬 입력값을 저장 형식(소문자 16진수)으로 다듬습니다.
 *        붙여넣기에 흔히 딸려오는 공백과 `sha256:` 접두어를 걷어냅니다.
 * @매개변수: value - 입력된 원본 문자열
 * @반환값: 정규화된 문자열 (형식 검증은 SHA256_RE로 따로 한다)
 */
export function normalizeChecksum(value: string): string {
  return value.trim().replace(/^sha-?256[:\s]*/i, '').replace(/\s+/g, '').toLowerCase()
}
