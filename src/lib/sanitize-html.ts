/**
 * @파일: lib/sanitize-html.ts
 * @설명: 상품 설명·FAQ·소개 등 리치 텍스트 서버측 sanitize — ⚠️ 서버 전용(클라이언트 import 금지, sanitize-html은 Node 모듈).
 *        허용 규칙은 lib/rich-allowlist.ts(단일 출처)를 그대로 소비하며, 클라이언트 편의 정제(lib/sanitize-client.ts)와 동일 규칙을 쓴다.
 *        허용: 문단·서식·목록 + div·center·표(table…)·figure·blockquote·hr + img·a + 유튜브 임베드 iframe.
 *        인라인 style은 표시용(색·정렬·여백·테두리·칸 폭 등, rich-allowlist STYLE_RULES)만 값까지 화이트리스트, 그 외 style·모든 on* 이벤트·script/style/form/object는 제거.
 *        저장 시점(admin 라우트)과 공개 렌더 직전(RichContent)에 각각 호출되어 이중 방어한다.
 */

import sanitizeHtml from 'sanitize-html'
import { looksLikeHtml, embedYouTubeHtml, wrapBareIframes } from './rich-html'
import { legacyToHtml } from './legacy-markdown'
import { ALLOWED_TAGS, ALLOWED_ATTRS, GLOBAL_ATTRS, STYLE_RULES, isAllowedIframeSrc } from './rich-allowlist'

// 공유 허용목록으로 sanitize-html 옵션을 구성(규칙 변경은 rich-allowlist.ts 한 곳에서)
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: { '*': [...GLOBAL_ATTRS], ...ALLOWED_ATTRS },
  allowedStyles: { '*': STYLE_RULES },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'], iframe: ['https'] },
  allowProtocolRelative: false,
  // 유튜브 호스트 iframe만 1차 통과(경로 /embed/ 강제는 exclusiveFilter가 담당)
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com'],
  // 허용되지 않은 태그는 버리되 내부 텍스트는 유지(script/style류는 sanitize-html 기본 nonTextTags로 내용째 제거)
  disallowedTagsMode: 'discard',
  // src가 유튜브 임베드 접두어(/embed/)가 아닌 iframe은 통째로 제거
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !isAllowedIframeSrc(frame.attribs?.src),
  transformTags: {
    // 링크: href만 유지 + 새 탭·안전 rel 강제
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs.href ? { href: attribs.href } : {}),
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
    // 이미지: src·alt·width만 유지 + lazy loading 자동 부여(style·on* 등 제거)
    img: (tagName, attribs) => {
      const out: Record<string, string> = { loading: 'lazy', decoding: 'async' }
      if (attribs.src) out.src = attribs.src
      if (attribs.alt) out.alt = attribs.alt
      if (attribs.width) out.width = attribs.width
      return { tagName, attribs: out }
    },
    // 유튜브 iframe: src만 유지 + 안전 속성 정규화(폭·style 등 제거)
    iframe: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs.src ? { src: attribs.src } : {}),
        title: attribs.title || 'YouTube video',
        loading: 'lazy',
        allow: 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: 'true',
      },
    }),
  },
}

/**
 * @함수명: sanitizeRichHtml
 * @설명: 신뢰할 수 없는 HTML을 허용목록 기반으로 정제한다. 빈 값이면 빈 문자열을 반환한다.
 * @매개변수: dirty - 정제 전 HTML(에디터 출력 또는 저장값)
 * @반환값: 허용 태그·속성만 남은 안전한 HTML
 */
export function sanitizeRichHtml(dirty: string | null | undefined): string {
  if (!dirty) return ''
  return sanitizeHtml(dirty, OPTIONS)
}

/**
 * @함수명: renderRichHtml
 * @설명: 저장값(HTML 또는 레거시 평문)을 공개 렌더용 안전 HTML로 변환하는 공용 파이프라인 — ⚠️ 서버 전용.
 *        레거시 평문은 legacyToHtml로 단락화 → sanitize → 단독 iframe을 16:9 래퍼로 감싼 뒤 → 단독 유튜브 URL 문단을 임베드로 치환.
 *        (iframe 래핑을 URL 임베드보다 먼저 수행해 중복 래핑을 방지한다)
 * @매개변수: content - HTML 또는 레거시 평문
 * @반환값: 안전하게 정제된 HTML(빈 값이면 빈 문자열)
 */
export function renderRichHtml(content: string | null | undefined): string {
  if (!content?.trim()) return ''
  const html = looksLikeHtml(content) ? content : legacyToHtml(content)
  return embedYouTubeHtml(wrapBareIframes(sanitizeRichHtml(html)))
}
