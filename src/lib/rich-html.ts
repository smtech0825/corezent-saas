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
 *        ⚠️ youtube-nocookie.com(임베드 저장 도메인)도 인식해야 재편집 왕복이 깨지지 않는다 — 이게 빠지면
 *        저장된 nocookie iframe이 편집기 노드로 안 잡혀 선택·삭제가 불가능해진다.
 * @매개변수: url - 검사할 URL 문자열
 * @반환값: videoId 또는 null
 */
export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
  )
  return m ? m[1] : null
}

// 유튜브 임베드 iframe에 부여하는 Permissions-Policy 값(단일 출처) — ⚠️ autoplay 포함(무음 자동재생 허용).
// 노드 renderHTML·nodeview·서버 sanitize·embedYouTubeHtml가 모두 이 값을 공유한다(허용 정의 두 벌 금지).
export const YT_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'

// 유튜브 임베드 src에서 보존을 허용하는 안전한 재생 제어 파라미터(값은 아래에서 영숫자·_·-만 재검증 → 주입 불가)
const YT_SAFE_PARAMS = new Set([
  'autoplay', 'mute', 'loop', 'playlist', 'playsinline', 'controls', 'start', 'end', 'rel', 'modestbranding',
])

/**
 * @함수명: normalizeYoutubeSrc
 * @설명: 유튜브 URL/임베드 src를 nocookie 임베드 URL로 정규화하되, 재생 제어용 안전 파라미터(autoplay·mute·loop 등)는 보존한다.
 *        - muted→mute 로 교정(유튜브는 mute 파라미터를 쓴다), loop=1이면 유튜브 사양상 playlist=<id>가 필요하므로 없으면 자동 보강.
 *        - 파라미터 값은 영숫자·_·-(≤20자)만 통과 → 따옴표/구분자/스크립트 주입 불가. videoId가 없으면 원본을 그대로 돌려준다(최종 차단은 sanitize).
 * @매개변수: src - 유튜브 URL 또는 임베드 src
 * @반환값: `https://www.youtube-nocookie.com/embed/<id>[?안전파라미터]` 또는 원본
 */
export function normalizeYoutubeSrc(src: string): string {
  const id = youtubeId(src || '')
  if (!id) return src
  const params = new Map<string, string>()
  const qIdx = src.indexOf('?')
  if (qIdx !== -1) {
    for (const pair of src.slice(qIdx + 1).split(/[&;]/)) {
      const eq = pair.indexOf('=')
      if (eq === -1) continue
      let key = decodeURIComponent(pair.slice(0, eq)).trim().toLowerCase()
      const val = decodeURIComponent(pair.slice(eq + 1)).trim()
      if (key === 'muted') key = 'mute' // 유튜브는 'mute' 파라미터를 사용(muted는 무시됨)
      if (!YT_SAFE_PARAMS.has(key)) continue
      if (!/^[A-Za-z0-9_-]{1,20}$/.test(val)) continue // 스크립트/구분자 주입 차단
      params.set(key, val)
    }
  }
  // loop 재생은 playlist=<id>가 있어야 실제로 반복된다(유튜브 사양)
  if (params.get('loop') === '1' && !params.has('playlist')) params.set('playlist', id)
  const qs = [...params].map(([k, v]) => `${k}=${v}`).join('&')
  return `https://www.youtube-nocookie.com/embed/${id}${qs ? `?${qs}` : ''}`
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
      `<div class="rc-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" ` +
      `title="YouTube video" loading="lazy" ` +
      `allow="${YT_IFRAME_ALLOW}" ` +
      `allowfullscreen></iframe></div>`
    )
  })
}

/**
 * @함수명: wrapBareIframes
 * @설명: sanitize를 통과한 단독 iframe(유튜브 임베드)을 16:9 반응형 래퍼(.rc-embed)로 감싼다.
 *        renderRichHtml에서 embedYouTubeHtml(단독 URL 임베드)보다 먼저 호출되므로, 이 시점의 iframe은 아직 래핑되지 않은
 *        원본 붙여넣기 iframe뿐이다(중복 래핑 없음). embedYouTubeHtml는 <p> 문단만 다루므로 여기서 만든 래퍼를 건드리지 않는다.
 * @매개변수: html - sanitize된 HTML
 * @반환값: 단독 iframe이 반응형 래퍼로 감싸진 HTML
 */
export function wrapBareIframes(html: string): string {
  if (!html || html.indexOf('<iframe') === -1) return html
  return html.replace(/<iframe\b[^>]*>\s*<\/iframe>/gi, (m) => `<div class="rc-embed">${m}</div>`)
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
