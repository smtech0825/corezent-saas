/**
 * @파일: lib/markdown.ts
 * @설명: 리치 마크다운 렌더러(RichMarkdown)와 목록 요약이 공유하는 순수 헬퍼.
 *        서버·클라이언트 양쪽에서 쓰도록 'use client' 없이 순수 함수만 둔다.
 */

/**
 * @함수명: normalizeHeadings
 * @설명: 라인 시작의 "#소제목"(공백 없음) 표기를 "# 소제목"으로 정규화한다.
 *        기존 데이터가 공백 없이 저장돼 있어도 헤딩으로 인식되게 한다.
 * @매개변수: md - 원본 마크다운 문자열
 * @반환값: 정규화된 마크다운
 */
export function normalizeHeadings(md: string): string {
  return md.replace(/^(#{1,6})(\S)/gm, '$1 $2')
}

/**
 * @함수명: youtubeId
 * @설명: 유튜브 URL에서 11자 videoId를 추출한다(youtu.be·watch·embed·shorts). 아니면 null.
 * @매개변수: url - 검사할 URL 문자열
 * @반환값: videoId 또는 null
 */
export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
  )
  return m ? m[1] : null
}

/**
 * @함수명: parseImageSize
 * @설명: 이미지 title 문자열의 "=값"을 파싱해 max-width(px 또는 %)를 반환한다. 없으면 undefined.
 *        예) "=600" → "600px", "=50%" → "50%"
 * @매개변수: title - 마크다운 이미지 title 문자열(선택)
 * @반환값: CSS max-width 문자열 또는 undefined(기본=본문 폭 100%)
 */
export function parseImageSize(title?: string | null): string | undefined {
  if (!title) return undefined
  const m = title.match(/=\s*(\d+)\s*(%?)/)
  if (!m) return undefined
  return m[2] === '%' ? `${m[1]}%` : `${m[1]}px`
}

/**
 * @함수명: stripMarkdown
 * @설명: 마크다운 문법 문자를 제거해 목록 카드용 plain-text 요약을 만든다(문법 문자가 카드에 노출되지 않게).
 * @매개변수: md - 원본 마크다운 문자열
 * @반환값: 문법이 제거된 순수 텍스트(공백 정리)
 */
export function stripMarkdown(md: string): string {
  if (!md) return ''
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')       // 이미지
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // 링크 → 텍스트만
    .replace(/^#{1,6}\s*/gm, '')                 // 헤딩 마커(공백 유무 무관)
    .replace(/^#{1,6}/gm, '')                    // "#소제목"(공백 없음)의 # 제거
    .replace(/(\*\*|__)(.*?)\1/g, '$2')          // 굵게
    .replace(/(\*|_)(.*?)\1/g, '$2')             // 기울임
    .replace(/`([^`]*)`/g, '$1')                 // 인라인 코드
    .replace(/^\s*>\s?/gm, '')                   // 인용
    .replace(/^\s*[-*+]\s+/gm, '')               // 순서 없는 목록
    .replace(/^\s*\d+\.\s+/gm, '')               // 순서 있는 목록
    .replace(/https?:\/\/\S+/g, '')              // 단독 URL(유튜브 등)
    .replace(/\s+/g, ' ')                        // 공백 정리
    .trim()
}
