/**
 * @파일: components/admin/tiptap-style.ts
 * @설명: TipTap 기본 노드가 파싱 시 버리는 '표시용 인라인 style'(+표 셀 nowrap)을 소스↔리치 왕복 보존하는 확장.
 *        HTML 소스 모드에서 넣은 표·문단·제목의 배경·테두리·색·정렬·여백·폭이 리치 모드로 전환해도 사라지지 않게 한다.
 *        (기본 Table/TableCell·Paragraph·Heading 확장은 구조만 유지하고 style을 떨궈 왕복 시 서식이 소실된다.)
 *        값은 저장·토글 시 rich-allowlist(sanitize)로 재검증되므로 그대로 통과시켜도 안전하다(보안 경계는 서버 저장).
 *        text-align은 TextAlign 확장이 heading/paragraph에서 별도 관리하므로, 그 두 노드에선 style의 text-align만
 *        제거해 렌더(중복 출력 방지)하고, 표 셀의 text-align은 TextAlign 대상이 아니라 style로 그대로 보존한다.
 */

import { Extension } from '@tiptap/core'

/** style 문자열에서 text-align 선언만 제거(heading/paragraph용 — 정렬은 TextAlign이 담당) */
function withoutTextAlign(style: string): string {
  return style
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((decl) => !/^text-align\s*:/i.test(decl))
    .join('; ')
}

/** 인라인 style 왕복 속성 정의(transform으로 렌더 시 특정 선언 제거 가능) */
function styleAttribute(transform?: (s: string) => string) {
  return {
    style: {
      default: null as string | null,
      parseHTML: (el: HTMLElement) => el.getAttribute('style') || null,
      renderHTML: (attrs: { style?: string | null }) => {
        if (!attrs.style) return {}
        const s = transform ? transform(attrs.style) : attrs.style
        return s ? { style: s } : {}
      },
    },
  }
}

/** 표 셀 nowrap(레거시 표현 속성) 왕복 보존 */
const nowrapAttribute = {
  nowrap: {
    default: null as boolean | null,
    parseHTML: (el: HTMLElement) => (el.hasAttribute('nowrap') ? true : null),
    renderHTML: (attrs: { nowrap?: boolean | null }) => (attrs.nowrap ? { nowrap: 'nowrap' } : {}),
  },
}

/**
 * @확장: PreserveStyle
 * @설명: heading·paragraph·표(table/tableRow/tableHeader/tableCell)에 인라인 style을, 표 셀엔 nowrap을
 *        전역 속성으로 추가해 리치↔소스 왕복 시 서식이 보존되게 한다.
 */
export const PreserveStyle = Extension.create({
  name: 'preserveStyle',
  addGlobalAttributes() {
    return [
      { types: ['heading', 'paragraph'], attributes: styleAttribute(withoutTextAlign) },
      { types: ['table', 'tableRow', 'tableHeader', 'tableCell'], attributes: styleAttribute() },
      { types: ['tableHeader', 'tableCell'], attributes: nowrapAttribute },
    ]
  },
})
