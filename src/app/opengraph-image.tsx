/**
 * @파일: app/opengraph-image.tsx
 * @설명: 사이트 기본 소셜 미리보기 이미지 — 자기 이미지를 따로 두지 않은 모든 공개 페이지가 이걸 쓴다.
 *        (상품 상세처럼 metadata에서 openGraph.images를 직접 지정한 페이지는 그쪽이 우선한다.)
 */

import { renderOgImage, size, contentType } from '@/lib/og-image'

export { size, contentType }
export const alt = 'CoreZent — 공무원 행정문서 AI 지니워크'

export default async function Image() {
  return renderOgImage({
    title: '행정문서를 자료 입력 한 번으로',
    subtitle: '공무원 업무에 맞춘 AI 문서 작성 프로그램, 지니워크',
  })
}
