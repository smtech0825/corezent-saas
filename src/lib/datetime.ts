/**
 * @파일: lib/datetime.ts
 * @설명: 날짜/시각 표시 공용 포맷 — 한국 로케일. 화면마다 toLocaleString을 흩뿌리지 않고 이 곳에서만 관리.
 */

/**
 * @함수명: formatDateTimeKR
 * @설명: 타임스탬프를 '날짜 + 시:분(24시간)'으로 표시합니다. (예: "2026. 7. 3. 14:27")
 * @매개변수: d - ISO 문자열 또는 null (없으면 "—")
 * @반환값: 포맷된 문자열
 */
export function formatDateTimeKR(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/**
 * @함수명: formatDateKR
 * @설명: 타임스탬프를 '연 월 일'로 짧게 표시합니다. (예: "2026. 7. 3.")
 * @매개변수: d - ISO 문자열 또는 null (없으면 "—")
 * @반환값: 포맷된 문자열
 */
export function formatDateKR(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })
}
