/**
 * @파일: lib/attachment.ts
 * @설명: 문의 첨부의 공용 상수·헬퍼 — 서버(제출 액션)와 클라이언트(첨부 칸 UI)가 함께 쓴다.
 *        ★ 'use client' 지시어를 붙이면 안 된다 — 서버 코드가 클라이언트 모듈의 값을
 *        import하면 값이 아니라 클라이언트 참조가 들어와 검증이 깨진다(검증 도구 지적).
 */

/** 첨부 최대 크기 — 비회원 문의 폼과 동일한 5MB (새 값을 정하지 않는다) */
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024

/**
 * @함수명: formatFileSize
 * @설명: 바이트 수를 사람이 읽는 단위(B·KB·MB)로 바꿉니다.
 * @매개변수: bytes - 파일 크기(바이트)
 * @반환값: "1.2 MB" 형태의 문자열
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 로그인 문의 첨부의 허용 확장자(소문자) — 오류 화면·문서·압축 위주.
 * 실행 파일 차단을 목록으로 하면 우회 변형(후행 점·공백·희귀 확장자)을 다 못 막아
 * 허용 방식으로 잠근다(검증 도구 지적). 비회원 폼은 기존 동작(무제한) 그대로다.
 */
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp',
  'pdf', 'txt', 'log', 'csv', 'zip',
  'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
] as const

/**
 * @함수명: normalizeAttachmentExt
 * @설명: 파일명에서 확장자를 안전하게 뽑습니다 — 앞뒤 공백·후행 점을 제거하고 소문자로.
 *        "setup.exe."(후행 점)·"a.EXE "(공백) 같은 우회 변형이 같은 값으로 정규화됩니다.
 * @매개변수: fileName - 사용자가 보낸 원본 파일명
 * @반환값: 정규화된 확장자(없으면 빈 문자열)
 */
export function normalizeAttachmentExt(fileName: string): string {
  const trimmed = fileName.trim().replace(/[.\s]+$/, '')
  const idx = trimmed.lastIndexOf('.')
  if (idx <= 0) return ''
  return trimmed.slice(idx + 1).trim().toLowerCase()
}

/**
 * @함수명: isAllowedAttachment
 * @설명: 정규화된 확장자가 허용 목록에 있는지 판정합니다.
 * @매개변수: ext - normalizeAttachmentExt가 돌려준 확장자
 * @반환값: 허용이면 true
 */
export function isAllowedAttachment(ext: string): boolean {
  return (ALLOWED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext)
}

/**
 * @함수명: safeDownloadName
 * @설명: 내려받기 파일명을 서버가 안전하게 재조립합니다 — 경로·제어·주소 특수문자를
 *        _로 치환하고 길이를 제한한 뒤, 실제 저장된 확장자를 끝에 강제합니다.
 * @매개변수: originalName - 원본 파일명 / ext - 저장 시 확인된 확장자
 * @반환값: "화면캡처.png" 형태의 안전한 파일명
 */
export function safeDownloadName(originalName: string, ext: string): string {
  const base = originalName
    .replace(/\.[^.]*$/, '')
    .replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.\- ]/g, '_')
    .trim()
    .slice(0, 60) || 'attachment'
  return ext ? `${base}.${ext}` : base
}
