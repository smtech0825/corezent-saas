/**
 * @파일: app/rss.xml/route.ts
 * @설명: RSS 2.0 피드 (/rss.xml) — 활성 상품의 버전 업데이트(changelogs)를 최신순으로 노출.
 *        네이버 서치어드바이저·구글 등 검색엔진 RSS 제출용. 다운로드 링크(download_urls)는
 *        피드 콘텐츠 성격에 맞지 않아 제외하고, 각 항목은 해당 상품 상세 페이지로 연결한다.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

interface ChangelogRow {
  id: string
  version: string
  release_date: string
  content: {
    new_features?: string[]
    improvements?: string[]
    bug_fixes?: string[]
  } | null
  products: { name: string; slug: string; is_active: boolean } | null
}

/** XML 특수문자 이스케이프 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * @함수명: GET
 * @설명: 최근 활성 상품 changelog 30건을 RSS 2.0 XML로 반환합니다.
 * @반환값: application/rss+xml 응답
 */
export async function GET() {
  const client = createAdminClient()
  const { data } = await client
    .from('changelogs')
    .select('id, version, release_date, content, products(name, slug, is_active)')
    .order('release_date', { ascending: false })
    .limit(30)

  const rows = ((data ?? []) as unknown as ChangelogRow[]).filter((row) => row.products?.is_active)

  const items = rows
    .map((row) => {
      const product = row.products!
      const link = `${SITE_URL}/product/${product.slug}`
      const highlights = [
        ...(row.content?.new_features ?? []),
        ...(row.content?.improvements ?? []),
        ...(row.content?.bug_fixes ?? []),
      ].slice(0, 5)
      const description = highlights.length > 0
        ? highlights.join(' · ')
        : `${product.name} ${row.version} 업데이트`
      const pubDate = new Date(row.release_date).toUTCString()

      return `    <item>
      <title>${escapeXml(`${product.name} ${row.version}`)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(row.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CoreZent 업데이트 소식</title>
    <link>${SITE_URL}</link>
    <description>CoreZent 제품의 새 버전과 업데이트 소식을 전해드립니다.</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
