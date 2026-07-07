/**
 * @파일: api/admin/seo/reindex/route.ts
 * @설명: 관리자 색인 재요청 API — 지정 URL(또는 sitemap 전체)을 검색엔진에 제출한다.
 *        IndexNow(Bing·Naver 등) + Google Indexing API 두 채널로 동시에 알림.
 *        - body.urls 배열이 있으면 해당 URL만, 없으면 sitemap.xml의 모든 공개 URL을 대상으로 함
 *        - 관리자 전용(requireAdmin). /api/* 라우트라 robots 크롤 대상도 아님.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { submitUrlsToSearchEngines } from '@/lib/seo/indexing'
import sitemap from '@/app/sitemap'

export const dynamic = 'force-dynamic'

/**
 * @함수명: POST
 * @설명: 색인 제출을 트리거한다. 관리자 인증 → 대상 URL 확정 → 두 채널 제출 결과 반환.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.response

    // 요청 body에서 URL 목록 파싱(선택). http(s) 절대 URL만 허용.
    let urls: string[] = []
    try {
      const body = await req.json()
      if (Array.isArray(body?.urls)) {
        urls = body.urls.filter(
          (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//i.test(u),
        )
      }
    } catch {
      /* body 없음/파싱 실패 → sitemap 전체 사용 */
    }

    // 지정 URL이 없으면 sitemap.xml의 전체 공개 URL을 대상으로 함
    if (urls.length === 0) {
      const entries = await sitemap()
      urls = entries.map((e) => e.url)
    }

    const results = await submitUrlsToSearchEngines(urls)
    const ok = results.some((r) => r.ok)
    return NextResponse.json({ ok, count: urls.length, results })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '색인 재요청에 실패했습니다.' },
      { status: 500 },
    )
  }
}
