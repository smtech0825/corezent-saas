/**
 * @파일: app/robots.ts
 * @설명: Next.js Metadata API 기반 robots.txt (/robots.txt 로 자동 서빙)
 *        - 검색엔진 크롤러 규칙 정의 + 사이트맵(/sitemap.xml) 위치 안내
 *        - 비공개/기능성 경로(dashboard·admin·auth·api·order·활성화 등)는 크롤링 제외
 */

import type { MetadataRoute } from 'next'

/** 사이트 기본 URL — 배포 env 우선, 없으면 운영 도메인 폴백. 끝 슬래시 제거 */
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  'https://www.corezent.com'
).replace(/\/+$/, '')

/**
 * @함수명: robots
 * @설명: robots.txt 규칙과 사이트맵 위치를 반환합니다.
 * @반환값: MetadataRoute.Robots
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 로그인·관리자·API 등 색인 가치가 없거나 비공개인 경로 차단
      disallow: ['/dashboard', '/admin', '/auth', '/api', '/order', '/activate', '/r/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
