/**
 * @파일: lib/rich-allowlist.ts
 * @설명: 리치 텍스트 sanitize 허용목록(단일 출처) — 서버(sanitize-html)와 클라이언트(DOMParser) 정제기가
 *        같은 규칙을 공유하도록 순수 상수·판별 함수만 둔다(외부 의존 없음 → 클라이언트 번들에 들어가도 안전).
 *        서버 정제는 lib/sanitize-html.ts, 클라이언트 편의 정제는 lib/sanitize-client.ts가 이 목록을 소비한다.
 *        ⚠️ 규칙을 바꿀 때는 이 파일 한 곳만 고치면 서버·클라이언트가 동시에 반영된다.
 */

// 허용 태그 — 문단·서식·목록 + 구조(div·center·표·figure·인용·구분선) + 유튜브 임베드 iframe
export const ALLOWED_TAGS = [
  'p', 'h2', 'h3', 'strong', 'em', 'u', 'a', 'img', 'ul', 'ol', 'li', 'span', 'br',
  'div', 'center', 'blockquote', 'hr', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'iframe',
] as const

// 태그와 그 안의 텍스트까지 통째로 제거(내용 보존 금지) — 스크립트/스타일류·문서 메타
export const VOID_REMOVE_TAGS = [
  'script', 'style', 'noscript', 'template', 'textarea', 'title', 'head', 'object', 'embed',
] as const

// 태그별 추가 허용 속성(style은 GLOBAL_ATTRS로 모든 태그 공통 허용 — 값은 STYLE_RULES로 제한)
// 표시용 레거시 속성(align·nowrap·width)은 실행 불가한 표현 속성이라 표·셀에 한해 허용한다.
export const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'width', 'alt', 'loading', 'decoding'],
  iframe: ['src', 'title', 'loading', 'allow', 'allowfullscreen', 'width'],
  table: ['align', 'width'],
  thead: ['align'],
  tbody: ['align'],
  tr: ['align'],
  td: ['colspan', 'rowspan', 'align', 'nowrap', 'width'],
  th: ['colspan', 'rowspan', 'align', 'nowrap', 'width'],
}

// 모든 허용 태그에 공통 허용되는 속성(값은 STYLE_RULES로 화이트리스트 검증)
export const GLOBAL_ATTRS = ['style'] as const

// 인라인 style 값 화이트리스트 정규식 — 모두 앵커(^…$)로 전체 일치만 통과.
// ⚠️ 어떤 값도 괄호 함수(url()·expression() 등)를 허용하지 않는다. 유일한 예외는 색상 rgb()/rgba()와
//    font-size의 산술 calc()뿐이며, 둘 다 문자·따옴표·콜론을 담을 수 없어 CSS 주입이 불가능하다.
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RGB_COLOR = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/
// 이름있는 색(white·navy·transparent 등) — 괄호·따옴표가 없어 url()/expression() 주입 불가
const NAMED_COLOR = /^[a-z]{3,20}$/
const COLOR = [HEX_COLOR, RGB_COLOR, NAMED_COLOR]
const TEXT_ALIGN = /^(left|center|right|justify)$/
const WHITE_SPACE = /^(normal|nowrap|pre|pre-wrap|pre-line|break-spaces)$/
const BORDER_COLLAPSE = /^(separate|collapse)$/
// 단일 길이값(px·%·em·rem). width·padding-측면 등에 공용
const LENGTH = /^\d{1,4}(\.\d{1,2})?(px|%|em|rem)?$/
// 길이 1~4개(공백 구분) — padding·border-radius·border-spacing 단축 공용
const LENGTHS_1_4 = /^\d{1,4}(\.\d{1,2})?(px|%|em|rem)?(\s+\d{1,4}(\.\d{1,2})?(px|%|em|rem)?){0,3}$/
// margin 단축: 각 값이 길이 또는 auto(가운데 정렬용) — 1~4개
const MARGIN = /^(\d{1,4}(\.\d{1,2})?(px|%|em|rem)?|auto)(\s+(\d{1,4}(\.\d{1,2})?(px|%|em|rem)?|auto)){0,3}$/
const MARGIN_SIDE = /^(\d{1,4}(\.\d{1,2})?(px|%|em|rem)?|auto)$/
// border 단축: [width] [style] [color] (예: 1px solid #d9e0ec) 또는 none/0
const BORDER = /^(none|0|\d{1,3}(\.\d{1,2})?(px|em|rem)\s+(solid|dashed|dotted|double|groove|ridge|inset|outset|none|hidden)\s+(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)|[a-z]{3,20}))$/
// font-size: 단일 길이 또는 두 항 calc(1em + 1px) — calc 안엔 숫자·단위·연산자·공백만(문자열 주입 불가)
const FONT_SIZE = /^(\d{1,3}(\.\d{1,2})?(px|pt|em|rem|%)?|calc\(\s*\d{1,3}(\.\d{1,2})?(px|pt|em|rem|%)?\s*[-+*/]\s*\d{1,3}(\.\d{1,2})?(px|pt|em|rem|%)?\s*\))$/

// 허용 인라인 style 속성(그 외 style은 전부 제거). sanitize-html의 allowedStyles 형식과 동일(RegExp[]).
// 표시용(정렬·색·여백·테두리·칸)만 열고, 위치/실행/외부리소스(position·url()·expression() 등)는 통과 불가.
export const STYLE_RULES: Record<string, RegExp[]> = {
  color: COLOR,
  background: COLOR,
  'background-color': COLOR,
  'text-align': [TEXT_ALIGN],
  'white-space': [WHITE_SPACE],
  width: [LENGTH],
  'font-size': [FONT_SIZE],
  margin: [MARGIN],
  'margin-top': [MARGIN_SIDE],
  'margin-right': [MARGIN_SIDE],
  'margin-bottom': [MARGIN_SIDE],
  'margin-left': [MARGIN_SIDE],
  padding: [LENGTHS_1_4],
  'padding-top': [LENGTH],
  'padding-right': [LENGTH],
  'padding-bottom': [LENGTH],
  'padding-left': [LENGTH],
  border: [BORDER],
  'border-top': [BORDER],
  'border-right': [BORDER],
  'border-bottom': [BORDER],
  'border-left': [BORDER],
  'border-collapse': [BORDER_COLLAPSE],
  'border-spacing': [LENGTHS_1_4],
  'border-radius': [LENGTHS_1_4],
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
 * @함수명: isAllowedIframeWidth
 * @설명: 유튜브 임베드 폭 값이 안전한 형식(1~4자리 숫자 + px/%)인지 검사한다. 래퍼 style에 주입되므로 반드시 검증한다.
 * @매개변수: w - 폭 속성 값(예: '60%', '480px')
 * @반환값: 허용 형식이면 true
 */
export function isAllowedIframeWidth(w: string | null | undefined): boolean {
  return !!w && /^\d{1,4}(px|%)$/.test(w.trim())
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

// 리치 편집기(TipTap)가 정식 노드로 무손실 왕복(round-trip)하는 태그 — 각 태그마다 대응 확장이 있어야 한다.
//   문단·서식·목록(StarterKit) · blockquote·hr(StarterKit) · a(Link) · img(ResizableImage) · span(TextStyle/Color)
//   · table…(Table 확장군) · iframe(YoutubeEmbed, 유튜브 임베드만)
export const EDITOR_ROUNDTRIP_TAGS = [
  'p', 'h2', 'h3', 'strong', 'em', 'u', 'a', 'img', 'ul', 'ol', 'li', 'span', 'br',
  'blockquote', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'iframe',
] as const

// 전용 노드는 없지만 리치 편집 전환 시 래퍼만 평탄화되고 자식 내용은 보존되는 태그 — 잠금 대상 아님.
// center는 전용 노드가 없어 리치 전환 시 평탄화되지만, 표 가운데 정렬은 .rich-content CSS가 보편 담당하므로 내용/정렬 손실 없음.
export const EDITOR_FLATTEN_TAGS = ['div', 'figure', 'figcaption', 'center'] as const

// ⚠️ 불변식: EDITOR_ROUNDTRIP_TAGS ∪ EDITOR_FLATTEN_TAGS === ALLOWED_TAGS.
//    허용 태그를 늘렸는데 이 두 목록 어디에도 안 넣으면 editorUnsupportedTags가 그 태그를 잡아 소스 모드를 잠근다(소실 방지 안전망).

/**
 * @함수명: editorUnsupportedTags
 * @설명: HTML에서 리치 편집기가 노드 왕복도 평탄화도 못 해 내용이 소실될 태그명 목록을 돌려준다.
 *        표·유튜브가 정식 노드가 된 뒤로는 허용목록 태그에 대해 보통 빈 배열이며, 목록이 어긋난 경우에만 값이 찬다(안전망).
 * @매개변수: html - 검사할 HTML(보통 sanitize 통과분)
 * @반환값: 편집기가 다룰 수 없는 태그명 배열(중복 제거)
 */
export function editorUnsupportedTags(html: string | null | undefined): string[] {
  if (!html) return []
  const roundtrip = new Set<string>(EDITOR_ROUNDTRIP_TAGS)
  const flatten = new Set<string>(EDITOR_FLATTEN_TAGS)
  const found = new Set<string>()
  for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b/gi)) {
    const tag = m[1].toLowerCase()
    if (!roundtrip.has(tag) && !flatten.has(tag)) found.add(tag)
  }
  return [...found]
}
