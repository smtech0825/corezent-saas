/**
 * @파일: lib/support-categories.ts
 * @설명: 고객지원 문의 유형의 단일 출처 — 값(slug)·한국어 라벨.
 *        제출 폼(dashboard/support)·관리자 목록/상세(admin/support)·DB CHECK(062)가
 *        전부 이 목록과 일치해야 한다. 값을 바꾸면 062 CHECK도 함께 바꿔야 한다.
 */

/** 문의 유형 값 목록 — 062 마이그레이션의 CHECK와 동일 순서 */
export const SUPPORT_CATEGORIES = [
  { value: 'install_fail', label: '설치 실패' },
  { value: 'key_auth',     label: '키 인증' },
  { value: 'pc_change',    label: 'PC 변경' },
  { value: 'receipt',      label: '증빙 요청' },
  { value: 'ai_key',       label: 'AI 키 오류' },
  { value: 'other',        label: '기타' },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]['value']

/**
 * @함수명: isSupportCategory
 * @설명: 문자열이 유효한 문의 유형 값인지 판정합니다(폼 값 검증용).
 * @매개변수: v - 검사할 문자열
 * @반환값: 유효하면 true
 */
export function isSupportCategory(v: string): v is SupportCategory {
  return SUPPORT_CATEGORIES.some((c) => c.value === v)
}

/**
 * @함수명: supportCategoryLabel
 * @설명: 유형 값을 한국어 라벨로 바꿉니다. 모르는 값(과거 데이터 등)은 그대로 돌려줍니다.
 * @매개변수: v - 유형 값(없으면 null)
 * @반환값: 화면 표시용 라벨(값이 없으면 '—')
 */
export function supportCategoryLabel(v: string | null | undefined): string {
  if (!v) return '—'
  return SUPPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v
}
