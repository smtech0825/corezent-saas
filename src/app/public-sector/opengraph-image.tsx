/**
 * @파일: app/public-sector/opengraph-image.tsx
 * @설명: 기관 도입 안내 페이지 전용 소셜 미리보기.
 *        담당자끼리 공유되는 경로라 제목에 '수의계약·견적서'를 노출한다.
 */

import { renderOgImage, size, contentType } from '@/lib/og-image'

export { size, contentType }
export const alt = 'CoreZent 기관 도입 안내'

export default async function Image() {
  return renderOgImage({
    title: '부서 단위 도입을\n검토하시나요?',
    subtitle: '수의계약 · 견적서 · 세금계산서 안내',
  })
}
