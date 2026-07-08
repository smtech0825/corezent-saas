/**
 * @파일: lib/seo.ts
 * @설명: 공개 페이지 메타데이터(canonical·OG·Twitter Card) 조립 단일 출처.
 *        SITE_URL(www 정규화) 기준으로 경로를 절대주소로 조립하는 "로직"만 여기 있고,
 *        title·description·image 같은 "콘텐츠"는 각 페이지가 호출 시 전달한다.
 */

import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site'

interface PageMetaInput {
  /** 사이트 루트 기준 절대 경로 (예: '/', '/faq', '/product/geniepost') */
  path: string
  title: string
  description: string
  /** 소셜 공유 미리보기 이미지 (없으면 og:image/twitter:image를 생략) */
  image?: string
}

/**
 * @함수명: buildPageMetadata
 * @설명: 공개 페이지 하나의 canonical·OG·Twitter Card 메타데이터를 조립합니다.
 * @반환값: Next.js Metadata 객체
 */
export function buildPageMetadata({ path, title, description, image }: PageMetaInput): Metadata {
  const url = `${SITE_URL}${path}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'CoreZent',
      locale: 'ko_KR',
      type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}
