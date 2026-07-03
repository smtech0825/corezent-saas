/**
 * @파일: components/admin/tiptap-image.ts
 * @설명: TipTap 기본 Image 확장에 `width` 속성을 추가한 커스텀 이미지 노드.
 *        툴바의 크기 버튼(소/중/대/원본)이 이 width를 갱신하고, HTML `width` 속성으로 저장·렌더된다.
 *        (sanitize allowlist가 img[src,width]를 허용하므로 width는 인라인 style이 아닌 속성으로 보관한다)
 */

import Image from '@tiptap/extension-image'

/**
 * @상수: ResizableImage
 * @설명: width 속성(px 숫자 또는 '100%')을 저장/파싱/렌더하는 이미지 확장.
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
    }
  },
})
