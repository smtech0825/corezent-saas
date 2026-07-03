/**
 * @파일: lib/legacy-markdown.ts
 * @설명: 레거시 마크다운/평문 설명 → HTML 변환(공용). 편집기 로드와 공개 렌더러가 동일 규칙을 써서 표시가 어긋나지 않게 한다.
 *        marked(GFM, breaks=false — 기존 react-markdown 동작과 일치)로 파싱한 뒤, 에디터/sanitize 허용 범위에 맞게 후처리한다:
 *          · 제목 레벨을 h2/h3로 정규화(h1→h2, h4~6→h3)
 *          · 레거시 이미지 title "=600"/"=50%"를 width 속성으로 이관(title 제거)
 *        단독 유튜브 URL 문단은 그대로 남겨 공개 렌더러(embedYouTubeHtml)가 임베드한다.
 *        ⚠️ marked를 포함하므로 공개 client 번들에 들어가지 않도록 서버(RichContent)·admin 지연 청크(RichTextEditor)에서만 import한다.
 */

import { marked } from 'marked'

// GFM 표준. 단일 개행은 soft break(문단 병합) — 기존 공개 렌더러(react-markdown 기본값)와 동일하게 맞춘다.
marked.setOptions({ gfm: true, breaks: false })

/** 라인 시작 "#소제목"(공백 없음)을 "# 소제목"으로 정규화 — 레거시 데이터가 헤딩으로 인식되게 한다. */
function normalizeHeadingSpace(md: string): string {
  return md.replace(/^(#{1,6})(\S)/gm, '$1 $2')
}

/** 제목 레벨 축소(h1→h2, h4~6→h3) + 이미지 title "=크기" → width 속성 이관 */
function normalizeTags(html: string): string {
  let out = html
    .replace(/<h1(\s[^>]*)?>/gi, '<h2>')
    .replace(/<\/h1>/gi, '</h2>')
    .replace(/<h[4-6](\s[^>]*)?>/gi, '<h3>')
    .replace(/<\/h[4-6]>/gi, '</h3>')
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    const size = tag.match(/title="\s*=\s*(\d+)\s*(%?)\s*"/i)
    let t = tag.replace(/\s*title="[^"]*"/i, '') // 레거시 title(크기 표기 등) 제거
    if (size && !/\bwidth=/i.test(t)) {
      const w = size[2] === '%' ? `${size[1]}%` : size[1]
      t = t.replace(/<img\b/i, `<img width="${w}"`)
    }
    return t
  })
  return out
}

/**
 * @함수명: legacyToHtml
 * @설명: 레거시 마크다운/평문을 HTML로 변환한다(제목·굵게·기울임·링크·이미지·목록 지원, 이미지 크기·제목 레벨 정규화).
 *        결과는 저장·렌더 시 sanitize되므로 허용 밖 태그는 이후 단계에서 제거된다.
 * @매개변수: text - 레거시 원문(마크다운 또는 평문)
 * @반환값: HTML 문자열(빈 입력이면 빈 문자열)
 */
export function legacyToHtml(text: string | null | undefined): string {
  if (!text || !text.trim()) return ''
  const parsed = marked.parse(normalizeHeadingSpace(text), { async: false }) as string
  return normalizeTags(parsed)
}
