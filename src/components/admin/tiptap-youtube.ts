/**
 * @파일: components/admin/tiptap-youtube.ts
 * @설명: TipTap 공식 Youtube 확장(@tiptap/extension-youtube)을 extend해 CoreZent 파이프라인과 정합시킨 유튜브 임베드 노드.
 *        - 직렬화(renderHTML): 래퍼·width/height 없이 **단독 유튜브 임베드 iframe** 만 출력 → 서버 sanitize 허용목록(YT_EMBED_PREFIXES)과
 *          공개 렌더의 wrapBareIframes(.rc-embed 16:9 래핑)에 그대로 맞물린다(허용 정의를 두 벌로 만들지 않음 — Strict Rule #2).
 *        - 파싱(parseHTML): 유튜브 iframe(embed·watch·youtu.be)을 이 노드로 인식 → 소스 모드에서 붙여넣은 iframe·[유튜브] 버튼 삽입이 동일 노드로 통일.
 *        - 편집 미리보기(NodeView): 공개 렌더와 동일한 .rc-embed 16:9 래퍼로 표시하고, atom 노드라 클릭 선택·Delete 삭제가 된다.
 */

import Youtube from '@tiptap/extension-youtube'
import { youtubeId } from '@/lib/rich-html'

/**
 * @함수명: toEmbedUrl
 * @설명: 유튜브 URL/videoId를 nocookie 임베드 URL로 정규화한다(유효하지 않으면 원본 반환 → 최종 차단은 sanitize).
 * @매개변수: src - 유튜브 URL 또는 임베드 src
 * @반환값: `https://www.youtube-nocookie.com/embed/<id>` 또는 원본
 */
function toEmbedUrl(src: string): string {
  const id = youtubeId(src || '')
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : src
}

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

  // 저장/공개 렌더용: 래퍼 없는 임베드 iframe만 출력(반응형 래핑은 렌더 파이프라인이 담당)
  renderHTML({ HTMLAttributes }) {
    const src = toEmbedUrl((HTMLAttributes as { src?: string }).src || '')
    return ['iframe', { src }]
  },

  // 편집기 미리보기: 공개와 동일한 .rc-embed 16:9 래퍼. iframe은 pointer-events 차단해 클릭 시 노드가 선택되게 한다.
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'rc-embed'
      dom.style.cursor = 'pointer'
      const iframe = document.createElement('iframe')
      iframe.src = toEmbedUrl((node.attrs as { src?: string }).src || '')
      iframe.setAttribute('allowfullscreen', 'true')
      iframe.setAttribute('frameborder', '0')
      iframe.setAttribute('title', 'YouTube video')
      iframe.style.pointerEvents = 'none'
      dom.appendChild(iframe)
      // iframe 내부(교차 출처) 변경은 ProseMirror가 추적하지 않도록 무시 — atom 미리보기 안정화
      return { dom, ignoreMutation: () => true }
    }
  },
})
