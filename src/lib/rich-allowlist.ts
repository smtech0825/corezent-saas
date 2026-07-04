/**
 * @파일: lib/rich-allowlist.ts
 * @설명: 리치 텍스트 sanitize 허용목록(단일 출처) — 서버(sanitize-html)와 클라이언트(DOMParser) 정제기가
 *        같은 규칙을 공유하도록 순수 상수·판별 함수만 둔다(외부 의존 없음 → 클라이언트 번들에 들어가도 안전).
 *        서버 정제는 lib/sanitize-html.ts, 클라이언트 편의 정제는 lib/sanitize-client.ts가 이 목록을 소비한다.
 *        ⚠️ 규칙을 바꿀 때는 이 파일 한 곳만 고치면 서버·클라이언트가 동시에 반영된다.
 */

// 허용 태그 — 문단·서식·목록 + 구조(div·표·figure·인용·구분선) + 유튜브 임베드 iframe
export const ALLOWED_TAGS = [
  'p', 'h2', 'h3', 'strong', 'em', 'u', 'a', 'img', 'ul', 'ol', 'li', 'span', 'br',
  'div', 'blockquote', 'hr', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'iframe',
] as const

// 태그와 그 안의 텍스트까지 통째로 제거(내용 보존 금지) — 스크립트/스타일류·문서 메타
export const VOID_REMOVE_TAGS = [
  'script', 'style', 'noscript', 'template', 'textarea', 'title', 'head', 'object', 'embed',
] as const

// 태그별 추가 허용 속성(style은 GLOBAL_ATTRS로 모든 태그 공통 허용 — 값은 STYLE_RULES로 제한)
export const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'width', 'alt', 'loading', 'decoding'],
  iframe: ['src', 'title', 'loading', 'allow', 'allowfullscreen'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
}

// 모든 허용 태그에 공통 허용되는 속성(값은 STYLE_RULES로 화이트리스트 검증)
export const GLOBAL_ATTRS = ['style'] as const

// 인라인 style 값 화이트리스트 정규식
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RGB_COLOR = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/
const TEXT_ALIGN = /^(left|center|right|justify)$/
const LENGTH = /^\d{1,4}(\.\d{1,2})?(px|%|em|rem)?$/
const FONT_SIZE = /^\d{1,3}(\.\d{1,2})?(px|pt|em|rem|%)?$/

// 허용 인라인 style 속성(그 외 style은 전부 제거). sanitize-html의 allowedStyles 형식과 동일(RegExp[]).
export const STYLE_RULES: Record<string, RegExp[]> = {
  color: [HEX_COLOR, RGB_COLOR],
  'text-align': [TEXT_ALIGN],
  width: [LENGTH],
  'font-size': [FONT_SIZE],
}

// 유튜브 임베드 iframe만 허용하는 src 접두어(그 외 iframe은 제거)
export const YT_EMBED_PREFIXES = [
  'https://www.youtube.com/embed/',
  'https://www.youtube-nocookie.com/embed/',
] as const

/**
 * @함수명: isAllowedIframeSrc
 * @설명: iframe src가 유튜브 임베드 접두어로 시작하는지 검사한다(그 외 iframe은 차단).
 * @매개변수: src - iframe의 src 값
 * @반환값: 허용 가능한 유튜브 임베드면 true
 */
export function isAllowedIframeSrc(src: string | null | undefined): boolean {
  if (!src) return false
  const v = src.trim()
  return YT_EMBED_PREFIXES.some((p) => v.startsWith(p))
}

/**
 * @함수명: isSafeHref
 * @설명: a[href]가 http(s)·mailto·상대경로인지 검사한다(javascript:·protocol-relative(//) 차단).
 * @매개변수: href - 링크 href 값
 * @반환값: 안전하면 true
 */
export function isSafeHref(href: string | null | undefined): boolean {
  if (!href) return false
  const v = href.trim()
  if (v === '') return false
  if (v.startsWith('//')) return false // protocol-relative 차단
  const scheme = v.match(/^([a-z][a-z0-9+.-]*):/i)
  if (scheme) {
    const s = scheme[1].toLowerCase()
    return s === 'http' || s === 'https' || s === 'mailto'
  }
  return true // 상대경로·앵커(#·?) 허용
}

/**
 * @함수명: isSafeImgSrc
 * @설명: img[src]가 http(s)인지 검사한다(data:·상대경로 등 차단).
 * @매개변수: src - 이미지 src 값
 * @반환값: http(s)면 true
 */
export function isSafeImgSrc(src: string | null | undefined): boolean {
  return !!src && /^https?:\/\//i.test(src.trim())
}

/**
 * @함수명: isStyleValueAllowed
 * @설명: 인라인 style 한 속성(prop:value)이 화이트리스트에 부합하는지 검사한다.
 * @매개변수: prop - CSS 속성명, value - 값
 * @반환값: 허용되면 true
 */
export function isStyleValueAllowed(prop: string, value: string): boolean {
  const rules = STYLE_RULES[prop]
  if (!rules) return false
  const v = value.trim()
  return rules.some((re) => re.test(v))
}

/**
 * @함수명: hasSourceOnlyTags
 * @설명: HTML에 리치 편집기(TipTap)가 표현할 수 없어 소스 모드 유지가 필요한 태그(표·임베드)가 있는지 검사한다.
 * @매개변수: html - 검사할 HTML
 * @반환값: 표(table) 또는 iframe이 있으면 true
 */
export function hasSourceOnlyTags(html: string | null | undefined): boolean {
  if (!html) return false
  return /<(table|iframe)\b/i.test(html)
}
