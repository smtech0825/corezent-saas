/**
 * @파일: lib/sanitize-client.ts
 * @설명: 리치 편집기 HTML 소스 모드 toggle-off 시 클라이언트에서 미리 정제하는 편의용 sanitizer(브라우저 DOMParser 기반).
 *        ⚠️ 보안 경계가 아니다 — 실제 보안 정제는 서버 저장 시 sanitizeRichHtml가 수행한다.
 *        단, lib/rich-allowlist.ts의 동일 규칙을 공유하므로 사용자가 미리 보는 결과와 저장 결과가 거의 일치한다.
 *        허용 외 태그는 제거하고(스크립트/스타일류는 내용째, 그 외는 자식 보존 unwrap) 제거된 태그 목록을 함께 돌려준다.
 *        ⚠️ 브라우저 전용(DOMParser 필요) — 서버 컴포넌트에서 import 금지. RichTextEditor(ssr:false)에서만 사용한다.
 */

import {
  ALLOWED_TAGS, ALLOWED_ATTRS, GLOBAL_ATTRS, STYLE_RULES, VOID_REMOVE_TAGS,
  isAllowedIframeSrc, isSafeHref, isSafeImgSrc, isStyleValueAllowed,
} from './rich-allowlist'

const ALLOWED = new Set<string>(ALLOWED_TAGS)
const VOID_REMOVE = new Set<string>(VOID_REMOVE_TAGS)

/** @인터페이스: ClientSanitizeResult @설명: 정제된 HTML과 제거된 태그명 목록 */
export interface ClientSanitizeResult {
  html: string
  removed: string[]
}

/**
 * @함수명: sanitizeClientHtml
 * @설명: 신뢰할 수 없는 HTML을 허용목록 기준으로 정제하고(브라우저), 제거된 태그명 목록을 함께 반환한다.
 * @매개변수: dirty - 정제 전 HTML(소스 textarea 내용)
 * @반환값: { html: 정제된 HTML, removed: 제거된 태그명(중복 제거) }
 */
export function sanitizeClientHtml(dirty: string): ClientSanitizeResult {
  const removed = new Set<string>()
  if (!dirty || !dirty.trim()) return { html: '', removed: [] }
  const doc = new DOMParser().parseFromString(dirty, 'text/html')
  cleanChildren(doc.body, removed)
  return { html: doc.body.innerHTML.trim(), removed: [...removed] }
}

/**
 * @함수명: extractHtmlBody
 * @설명: 불러온 .html 파일 텍스트에서 <body> 내부만 추출한다(head·script·style·template 블록은 버림).
 * @매개변수: text - .html 파일 원문
 * @반환값: body 내부 HTML(정제 전 — 이후 toggle-off/저장 시 sanitize)
 */
export function extractHtmlBody(text: string): string {
  const doc = new DOMParser().parseFromString(text, 'text/html')
  doc.body.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove())
  return doc.body.innerHTML.trim()
}

/**
 * @함수명: cleanChildren
 * @설명: 부모 요소의 자식 노드를 재귀 정제한다 — 주석 제거, 허용 외 태그 제거/unwrap, 허용 태그는 속성 정제 후 하위로 재귀.
 * @매개변수: parent - 정제 대상 부모 요소, removed - 제거된 태그명을 모으는 Set
 * @반환값: 없음(parent를 제자리에서 수정)
 */
function cleanChildren(parent: Element, removed: Set<string>): void {
  // 순회 중 DOM 변경이 일어나므로 스냅샷을 뜬다
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.COMMENT_NODE) { parent.removeChild(node); continue }
    if (node.nodeType !== Node.ELEMENT_NODE) continue // 텍스트 노드는 유지
    const el = node as Element
    const tag = el.tagName.toLowerCase()

    if (VOID_REMOVE.has(tag)) { removed.add(tag); parent.removeChild(el); continue }

    if (!ALLOWED.has(tag)) {
      removed.add(tag)
      cleanChildren(el, removed) // 자식 먼저 정제
      while (el.firstChild) parent.insertBefore(el.firstChild, el) // 자식 보존(unwrap)
      parent.removeChild(el)
      continue
    }

    // 유튜브 임베드가 아닌 iframe은 제거
    if (tag === 'iframe' && !isAllowedIframeSrc(el.getAttribute('src'))) {
      removed.add('iframe')
      parent.removeChild(el)
      continue
    }

    cleanAttributes(el, tag)
    cleanChildren(el, removed)
  }
}

/**
 * @함수명: cleanAttributes
 * @설명: 한 요소의 속성을 정제한다 — on* 이벤트·허용 외 속성 제거, href/img src 스킴 검증, style 화이트리스트 필터, a[target=_blank] rel 보정.
 * @매개변수: el - 대상 요소, tag - 소문자 태그명
 * @반환값: 없음(el을 제자리에서 수정)
 */
function cleanAttributes(el: Element, tag: string): void {
  const allowed = new Set<string>([...GLOBAL_ATTRS, ...(ALLOWED_ATTRS[tag] || [])])
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on')) { el.removeAttribute(attr.name); continue } // 이벤트 핸들러 제거
    if (!allowed.has(name)) { el.removeAttribute(attr.name); continue }
    if (name === 'href' && !isSafeHref(attr.value)) { el.removeAttribute(attr.name); continue }
    if (name === 'src' && tag === 'img' && !isSafeImgSrc(attr.value)) { el.removeAttribute(attr.name); continue }
    if (name === 'style') {
      const filtered = filterStyle(attr.value)
      if (filtered) el.setAttribute('style', filtered)
      else el.removeAttribute('style')
    }
  }
  if (tag === 'a' && el.getAttribute('target') === '_blank') {
    el.setAttribute('rel', 'noopener noreferrer')
  }
}

/**
 * @함수명: filterStyle
 * @설명: 인라인 style 문자열에서 허용 속성·허용 값(rich-allowlist STYLE_RULES)만 남긴다.
 * @매개변수: style - 원본 style 속성 값
 * @반환값: 정제된 style 문자열(남은 게 없으면 빈 문자열)
 */
function filterStyle(style: string): string {
  const out: string[] = []
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const value = decl.slice(idx + 1).trim()
    if (STYLE_RULES[prop] && isStyleValueAllowed(prop, value)) out.push(`${prop}: ${value}`)
  }
  return out.join('; ')
}
