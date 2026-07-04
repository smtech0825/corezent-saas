/**
 * @컴포넌트: RichContent
 * @설명: 상품 설명(리치 텍스트)을 공개 페이지에 렌더하는 공용 컴포넌트 — ⚠️ 서버 전용(sanitize-html은 Node 모듈).
 *        저장값이 HTML이면 그대로, 레거시 평문이면 legacyToHtml로 변환한 뒤 서버측 sanitize를 한 번 더 적용하고
 *        단독 유튜브 URL 문단을 안전한 임베드로 치환한다. 스타일은 globals.css의 .rich-content 스코프가 담당한다.
 *        (이미지 lazy loading·width는 sanitize 단계에서 반영됨)
 */

import { renderRichHtml } from '@/lib/sanitize-html'
import { richToPlainText } from '@/lib/rich-html'

/**
 * @함수명: RichContent
 * @설명: content를 안전한 HTML로 정제·임베드 처리해 렌더한다. 빈 값이면 아무것도 렌더하지 않는다.
 * @매개변수: content - HTML 또는 레거시 평문, className - 외곽 래퍼 추가 클래스(선택)
 * @반환값: 렌더된 노드 또는 null
 */
export default function RichContent({ content, className }: { content: string; className?: string }) {
  if (!content?.trim()) return null
  const clean = renderRichHtml(content)
  // 텍스트도 미디어(이미지·임베드)도 없으면(예: 빈 <p></p>) 렌더하지 않는다.
  const hasContent = /<(img|iframe)\b/i.test(clean) || richToPlainText(clean).length > 0
  if (!hasContent) return null
  return (
    <div
      className={`rich-content${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
