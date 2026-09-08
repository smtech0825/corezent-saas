/**
 * @파일: lib/platforms.ts
 * @설명: 설치파일 플랫폼 키·표시 이름 단일 출처.
 *        관리자 변경 이력 편집기·공개 변경 이력·대시보드 다운로드 버튼·체크섬 목록이 함께 쓴다.
 *        키(windows·mac 등)는 `changelogs.download_urls`/`checksums` jsonb의 키와 같아야 한다.
 */

/** 화면에 나오는 순서 그대로 — 편집기의 입력칸 순서도 이 배열을 따른다 */
export const PLATFORMS: { key: string; label: string }[] = [
  { key: 'windows',      label: 'Windows' },
  { key: 'mac',          label: 'macOS' },
  { key: 'linux',        label: 'Linux' },
  { key: 'chrome_store', label: 'Chrome Store' },
  // 손님에게 보이는 두 곳(공개 변경 이력·대시보드 다운로드)이 쓰던 표기를 그대로 유지한다.
  // 관리자 편집기만 '웹'이었는데, 화면 문구를 바꾸지 않는 쪽으로 맞춘다.
  { key: 'web',          label: 'Web' },
]

/** 키 → 표시 이름 조회용 맵 (모르는 키는 호출 측에서 키 자체를 그대로 보여준다) */
export const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.key, p.label]),
)
