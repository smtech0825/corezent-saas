/**
 * @파일: lib/rich-html.ts
 * @설명: 리치 텍스트(HTML) 관련 순수 헬퍼 — 서버·클라이언트 양쪽에서 안전하게 쓰도록 외부 의존 없이 둔다.
 *        (서버 전용 sanitize는 lib/sanitize-html.ts, marked 포함 레거시 변환은 lib/legacy-markdown.ts에 분리 — 이 파일은 클라이언트 번들에 들어가도 안전)
 *        HTML 판별·유튜브 임베드·평문 요약을 담당한다.
 */

/**
 * @함수명: looksLikeHtml
 * @설명: 문자열이 HTML로 저장된 값인지(‘<’로 시작) 판별한다. 아니면 레거시 텍스트로 간주한다.
 * @매개변수: s - 검사할 문자열
 * @반환값: HTML로 보이면 true
 */
export function looksLikeHtml(s: string | null | undefined): boolean {
  return !!s && s.trimStart().startsWith('<')
}

/**
 * @함수명: youtubeId
 * @설명: 유튜브 URL에서 11자 videoId를 추출한다(youtu.be·watch·embed·shorts·v). 아니면 null.
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
 * @함수명: embedYouTubeHtml
 * @설명: 단독 유튜브 URL만 담긴 <p>(텍스트 또는 단일 링크)를 안전한 16:9 임베드로 치환한다.
 *        videoId를 정규식으로 검증한 후에만 iframe을 생성하므로 임의 iframe 주입 위험이 없다(sanitize 이후 실행).
 * @매개변수: html - sanitize된 HTML
 * @반환값: 유튜브 문단이 임베드로 치환된 HTML
 */
export function embedYouTubeHtml(html: string): string {
  if (!html) return ''
  return html.replace(/<p>([\s\S]*?)<\/p>/gi, (whole, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim() // <a> 래퍼 등 태그 제거 후 순수 텍스트
    if (!/^\S+$/.test(text)) return whole // URL 외 다른 내용이 있으면 문단 유지
    const id = youtubeId(text)
    if (!id) return whole
    return (
      `<div class="rc-embed"><iframe src="https://www.youtube.com/embed/${id}" ` +
      `title="YouTube video" loading="lazy" ` +
      `allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
      `allowfullscreen></iframe></div>`
    )
  })
}

/**
 * @함수명: richToPlainText
 * @설명: HTML 또는 레거시 마크다운 설명을 카드 요약용 순수 텍스트로 변환한다(태그·문법 제거, 공백 정리).
 * @매개변수: input - HTML 또는 마크다운/평문
 * @반환값: 순수 텍스트
 */
export function richToPlainText(input: string | null | undefined): string {
  if (!input) return ''
  let s = input
    .replace(/<[^>]+>/g, ' ') // HTML 태그 제거
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  // 레거시 마크다운 문법 흔적 제거
  s = s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^#{1,6}/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/https?:\/\/\S+/g, '')
  return s.replace(/\s+/g, ' ').trim()
}
