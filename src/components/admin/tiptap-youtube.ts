/**
 * @파일: components/admin/tiptap-youtube.ts
 * @설명: TipTap 공식 Youtube 확장(@tiptap/extension-youtube)을 extend해 CoreZent 파이프라인과 정합시킨 유튜브 임베드 노드.
 *        - 직렬화(renderHTML): 래퍼·width/height 없이 **단독 유튜브 임베드 iframe** 만 출력 → 서버 sanitize 허용목록(YT_EMBED_PREFIXES)과
 *          공개 렌더의 wrapBareIframes(.rc-embed 16:9 래핑)에 그대로 맞물린다(허용 정의를 두 벌로 만들지 않음 — Strict Rule #2).
 *        - 파싱(parseHTML): 유튜브 iframe(embed·watch·youtu.be)을 이 노드로 인식 → 소스 모드에서 붙여넣은 iframe·[유튜브] 버튼 삽입이 동일 노드로 통일.
 *        - 편집 미리보기(NodeView): 공개 렌더와 동일한 .rc-embed 16:9 래퍼로 표시하고, atom 노드라 클릭 선택·Delete 삭제가 된다.
 */

import Youtube from '@tiptap/extension-youtube'
import { youtubeId, normalizeYoutubeSrc, YT_IFRAME_ALLOW } from '@/lib/rich-html'

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

  // 유튜브 videoId를 가진 iframe만 이 노드로 파싱(그 외 iframe은 매칭 실패 → 편집기·sanitize가 제거)
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
  // 재생 제어 파라미터(autoplay·mute·loop 등)는 normalizeYoutubeSrc가 보존하고, allow에 autoplay를 넣어 자동재생을 허용한다.
  renderHTML({ HTMLAttributes }) {
    const src = normalizeYoutubeSrc((HTMLAttributes as { src?: string }).src || '')
    return ['iframe', { src, title: 'YouTube video', loading: 'lazy', allow: YT_IFRAME_ALLOW, allowfullscreen: 'true' }]
  },

  // 편집기 미리보기: 공개와 동일한 .rc-embed 16:9 래퍼. iframe은 pointer-events 차단해 클릭 시 노드가 선택되게 한다.
  // atom 노드 선택이 헷갈릴 때도 확실히 지울 수 있도록 편집기 전용 삭제 버튼(×)을 오버레이한다(공개 렌더엔 없음).
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div')
      dom.className = 'rc-embed'
      dom.style.cursor = 'pointer'

      const iframe = document.createElement('iframe')
      iframe.src = normalizeYoutubeSrc((node.attrs as { src?: string }).src || '')
      iframe.setAttribute('allow', YT_IFRAME_ALLOW)
      iframe.setAttribute('allowfullscreen', 'true')
      iframe.setAttribute('frameborder', '0')
      iframe.setAttribute('title', 'YouTube video')
      iframe.style.pointerEvents = 'none'
      dom.appendChild(iframe)

      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'rc-embed-del'
      del.setAttribute('contenteditable', 'false')
      del.setAttribute('title', '동영상 삭제')
      del.setAttribute('aria-label', '동영상 삭제')
      del.textContent = '×'
      del.addEventListener('click', (e) => {
        e.preventDefault()
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (typeof pos !== 'number') return
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
      })
      dom.appendChild(del)

      return {
        dom,
        // 삭제 버튼 이벤트는 ProseMirror가 가로채지 않게(노드 선택 대신 버튼 클릭이 처리되도록)
        stopEvent: (e) => del.contains(e.target as Node),
        // iframe 내부(교차 출처)·버튼 DOM 변경을 ProseMirror가 추적하지 않도록 무시 — atom 미리보기 안정화
        ignoreMutation: () => true,
      }
    }
  },
})
