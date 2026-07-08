/**
 * @파일: app/sitemap.ts
 * @설명: Next.js Metadata API 기반 동적 사이트맵 (/sitemap.xml 로 자동 서빙)
 *        - 검색엔진 크롤링용. 공개 콘텐츠 페이지 + DB의 활성 상품 상세(/product/[slug])를 자동 포함
 *        - 상품이 추가/수정되면 별도 작업 없이 반영됨(products.updated_at 기준 lastModified)
 *        - 비공개 경로(dashboard·admin·auth·api·order 등)는 의도적으로 제외
 *        - DB 조회 실패 시에도 정적 경로는 반환(사이트맵이 통째로 깨지지 않도록 try-catch)
 */

import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_URL } from '@/lib/site'

// 상품 상세를 DB에서 그리므로 빌드타임 정적 생성 대신 요청 시점에 생성(다른 DB 페이지와 동일 규칙)
export const dynamic = 'force-dynamic'

/**
 * @함수명: sitemap
 * @설명: 사이트맵 엔트리 배열을 생성합니다. 정적 공개 페이지 + 활성 상품 상세 페이지.
 * @반환값: MetadataRoute.Sitemap (URL·lastModified·changeFrequency·priority 목록)
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // 공개 정적 페이지 (경로, 변경 빈도, 우선순위)
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/product`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    // /changelog는 로그인 필수 페이지라 비로그인 크롤러는 접근할 수 없어 사이트맵에서 제외(robots.ts와 동일 기준)
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/legal/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // 활성 상품 상세 페이지(/product/[slug]) — DB에서 동적 조회
  let productRoutes: MetadataRoute.Sitemap = []
  try {
    const client = createAdminClient()
    const { data } = await client
      .from('products')
      .select('slug, updated_at')
      .eq('is_active', true)

    productRoutes = (data ?? [])
      .filter((p): p is { slug: string; updated_at: string | null } => Boolean(p?.slug))
      .map((p) => ({
        url: `${SITE_URL}/product/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
  } catch {
    // DB 조회 실패 시 상품 경로는 생략하고 정적 경로만 제공(사이트맵 전체 실패 방지)
    productRoutes = []
  }

  return [...staticRoutes, ...productRoutes]
}
