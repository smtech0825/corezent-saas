/**
 * @파일: components/admin/tiptap-youtube.ts
 * @설명: TipTap 공식 Youtube 확장(@tiptap/extension-youtube)을 extend해 CoreZent 파이프라인과 정합시킨 유튜브 임베드 노드.
 *        - 직렬화(renderHTML): 래퍼·width/height 없이 **단독 유튜브 임베드 iframe** 만 출력 → 서버 sanitize 허용목록(YT_EMBED_PREFIXES)과
 *          공개 렌더의 wrapBareIframes(.rc-embed 16:9 래핑)에 그대로 맞물린다(허용 정의를 두 벌로 만들지 않음 — Strict Rule #2).
 *        - 파싱(parseHTML): 유튜브 iframe(embed·watch·youtu.be)을 이 노드로 인식 → 소스 모드에서 붙여넣은 iframe·[유튜브] 버튼 삽입이 동일 노드로 통일.
 *        - 크기(width): iframe width 속성으로 저장/파싱(툴바 크기 바가 갱신). 공개 렌더는 wrapBareIframes가 이 폭을 .rc-embed 래퍼 max-width로 옮겨 가운데 정렬.
 *        - 편집 미리보기(NodeView): 공개 렌더와 동일한 .rc-embed 16:9 래퍼로 표시하고, atom 노드라 클릭 선택·Delete 삭제가 된다.
 */

import Youtube from '@tiptap/extension-youtube'
import { youtubeId, normalizeYoutubeSrc, setYoutubeControls, YT_IFRAME_ALLOW } from '@/lib/rich-html'

// 편집 오버레이 크기 프리셋(래퍼 max-width %). '전체'는 width 제거(콘텐츠 폭 100%)
const OVERLAY_SIZES: { label: string; width: string | null }[] = [
  { label: '소', width: '40%' },
  { label: '중', width: '60%' },
  { label: '대', width: '80%' },
  { label: '전체', width: null },
]

/**
 * @상수: YoutubeEmbed
 * @설명: 단독 임베드 iframe으로 직렬화되고 .rc-embed 미리보기를 갖는 유튜브 노드(공식 Youtube 확장 기반).
 */
export const YoutubeEmbed = Youtube.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      nocookie: true,
      controls: true,
      allowFullscreen: true,
    }
  },

  // width 속성 추가 — 크기 조절용(px 또는 % 문자열). 이미지(ResizableImage)와 동일하게 HTML width 속성으로 왕복한다.
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

  // 유튜브 videoId를 가진 iframe만 이 노드로 파싱(그 외 iframe은 매칭 실패 → 편집기·sanitize가 제거). width는 addAttributes가 함께 파싱.
  parseHTML() {
    return [
      {
        tag: 'iframe[src]',
        getAttrs: (element) => {
          const src = (element as HTMLElement).getAttribute('src') || ''
          return youtubeId(src) ? { src } : false
        },
      },
    ]
  },

  // 저장/공개 렌더용: 래퍼 없는 임베드 iframe만 출력(반응형 래핑은 렌더 파이프라인이 담당).
  // 재생 제어 파라미터(autoplay·mute·loop 등)는 normalizeYoutubeSrc가 보존하고, allow에 autoplay를 넣어 자동재생을 허용한다. width가 있으면 함께 출력.
  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as { src?: string; width?: string | null }
    const src = normalizeYoutubeSrc(attrs.src || '')
    const out: Record<string, string> = { src, title: 'YouTube video', loading: 'lazy', allow: YT_IFRAME_ALLOW, allowfullscreen: 'true' }
    if (attrs.width) out.width = attrs.width
    return ['iframe', out]
  },

  // 편집기 미리보기: 공개와 동일한 .rc-embed 16:9 래퍼. iframe은 pointer-events 차단.
  // 영상 위에 마우스를 올리면 나타나는 편집 오버레이 바(크기·컨트롤·삭제)를 제공한다 — 노드 선택 상태에 의존하지 않아 항상 동작(공개 렌더엔 없음).
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const attrs = node.attrs as { src?: string; width?: string | null }
      const dom = document.createElement('div')
      dom.className = 'rc-embed'
      dom.style.cursor = 'pointer'
      // 크기 조절 — 래퍼 max-width로 축소하고 가운데 정렬(공개 렌더 wrapBareIframes와 동일한 표시)
      if (attrs.width) {
        dom.style.maxWidth = attrs.width
        dom.style.marginLeft = 'auto'
        dom.style.marginRight = 'auto'
      }

      const iframe = document.createElement('iframe')
      iframe.src = normalizeYoutubeSrc(attrs.src || '')
      iframe.setAttribute('allow', YT_IFRAME_ALLOW)
      iframe.setAttribute('allowfullscreen', 'true')
      iframe.setAttribute('frameborder', '0')
      iframe.setAttribute('title', 'YouTube video')
      iframe.style.pointerEvents = 'none'
      dom.appendChild(iframe)

      // 이 노드의 현재 위치를 얻어 선택 후 명령을 적용(getPos는 렌더마다 최신값)
      const pos = () => (typeof getPos === 'function' ? getPos() : undefined)
      const apply = (fn: (p: number) => void) => {
        const p = pos()
        if (typeof p === 'number') fn(p)
      }

      const bar = document.createElement('div')
      bar.className = 'rc-embed-bar'
      bar.setAttribute('contenteditable', 'false')

      const addBtn = (label: string, title: string, onClick: () => void, danger = false) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.title = title
        b.className = danger ? 'rc-embed-btn rc-embed-btn-danger' : 'rc-embed-btn'
        b.addEventListener('click', (e) => { e.preventDefault(); onClick() })
        bar.appendChild(b)
        return b
      }
      const addLabel = (text: string) => {
        const s = document.createElement('span')
        s.className = 'rc-embed-label'
        s.textContent = text
        bar.appendChild(s)
      }

      // 크기
      addLabel('크기')
      for (const s of OVERLAY_SIZES) {
        addBtn(s.label, `크기 ${s.label}`, () => apply((p) => editor.chain().setNodeSelection(p).updateAttributes('youtube', { width: s.width }).run()))
      }
      // 컨트롤(재생바) 표시/숨김 — src의 controls 파라미터 토글
      addLabel('컨트롤')
      addBtn('표시', '컨트롤 표시', () => apply((p) => editor.chain().setNodeSelection(p).updateAttributes('youtube', { src: setYoutubeControls(attrs.src || '', true) }).run()))
      addBtn('숨김', '컨트롤 숨김', () => apply((p) => editor.chain().setNodeSelection(p).updateAttributes('youtube', { src: setYoutubeControls(attrs.src || '', false) }).run()))
      // 삭제
      addBtn('삭제', '동영상 삭제', () => apply((p) => editor.chain().focus().deleteRange({ from: p, to: p + node.nodeSize }).run()), true)

      dom.appendChild(bar)

      return {
        dom,
        // 오버레이 바 이벤트는 ProseMirror가 가로채지 않게(버튼 클릭이 그대로 처리되도록)
        stopEvent: (e) => bar.contains(e.target as Node),
        // iframe 내부(교차 출처)·버튼 DOM 변경을 ProseMirror가 추적하지 않도록 무시 — 미리보기 안정화
        ignoreMutation: () => true,
      }
    }
  },
})
