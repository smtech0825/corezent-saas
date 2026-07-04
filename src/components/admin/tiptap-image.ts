/**
 * @파일: components/admin/tiptap-image.ts
 * @설명: TipTap 기본 Image 확장에 `width`·`align` 속성을 추가한 커스텀 이미지 노드.
 *        툴바의 크기 버튼(소/중/대/원본)이 width를, 정렬 버튼(왼쪽/가운데/오른쪽)이 align을 갱신한다.
 *        - width: HTML `width` 속성으로 저장/렌더(sanitize가 img[width] 허용).
 *        - align: HTML `data-align`(left/center/right) 속성으로 저장/렌더. sanitize가 img[style]은 제거하므로
 *          정렬은 style이 아닌 data-align 속성으로 보관하고, 실제 가운데/좌우 정렬은 .rich-content CSS가 담당한다.
 */

import Image from '@tiptap/extension-image'

/**
 * @상수: ResizableImage
 * @설명: width(px 숫자 또는 '100%')·align(left/center/right)을 저장/파싱/렌더하는 이미지 확장.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('width'),
        renderHTML: (attributes) => {
          const w = (attributes as { width?: string | null }).width
          return w ? { width: w } : {}
        },
      },
      align: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-align'),
        renderHTML: (attributes) => {
          const a = (attributes as { align?: string | null }).align
          return a ? { 'data-align': a } : {}
        },
      },
    }
  },
})
