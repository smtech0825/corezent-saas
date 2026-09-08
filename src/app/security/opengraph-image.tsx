/**
 * @파일: app/security/opengraph-image.tsx
 * @설명: 보안·개인정보 안내 페이지 전용 소셜 미리보기.
 *        기관 보안 담당자에게 링크로 전달되는 페이지라 제목을 따로 둔다.
 */

import { renderOgImage, size, contentType } from '@/lib/og-image'

export { size, contentType }
export const alt = 'CoreZent 보안·개인정보 안내'

export default async function Image() {
  return renderOgImage({
    title: '자료가 어디로 가는지\n그대로 말씀드립니다',
    subtitle: '보안·개인정보 안내',
  })
}
