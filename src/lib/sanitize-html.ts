/**
 * @파일: lib/sanitize-html.ts
 * @설명: 상품 설명(리치 텍스트) 서버측 sanitize — ⚠️ 서버 전용(클라이언트 import 금지, sanitize-html은 Node 모듈).
 *        허용 태그·속성 allowlist 외 모든 것(script/iframe/onclick 등)을 제거한다. 저장 시점에 반드시 호출한다.
 *        허용: p, h2, h3, strong, em, u, a[href], img[src,width,alt], ul, ol, li, span[style는 color만], br.
 *        (img에는 lazy loading을 자동 부여, a에는 target/rel을 자동 부여 — 안전한 부가 속성)
 */

import sanitizeHtml from 'sanitize-html'

// 색상 style 값 화이트리스트 — hex / rgb(a)만 허용(그 외 style 속성은 전부 제거)
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RGB_COLOR = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/

/**
 * @함수명: sanitizeRichHtml
 * @설명: 신뢰할 수 없는 HTML을 allowlist 기반으로 정제한다. 빈 값이면 빈 문자열을 반환한다.
 * @매개변수: dirty - 정제 전 HTML(에디터 출력 또는 저장값)
 * @반환값: 허용 태그·속성만 남은 안전한 HTML
 */
export function sanitizeRichHtml(dirty: string | null | undefined): string {
  if (!dirty) return ''
  return sanitizeHtml(dirty, {
    allowedTags: ['p', 'h2', 'h3', 'strong', 'em', 'u', 'a', 'img', 'ul', 'ol', 'li', 'span', 'br'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'width', 'alt', 'loading', 'decoding'],
      span: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowedStyles: {
      span: { color: [HEX_COLOR, RGB_COLOR] },
    },
    // 허용되지 않은 태그는 버리되(내용은 유지), h1 등은 자동 제거된다.
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...(attribs.href ? { href: attribs.href } : {}),
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      img: (tagName, attribs) => {
        const out: Record<string, string> = { loading: 'lazy', decoding: 'async' }
        if (attribs.src) out.src = attribs.src
        if (attribs.alt) out.alt = attribs.alt
        if (attribs.width) out.width = attribs.width
        return { tagName, attribs: out }
      },
    },
  })
}
