/**
 * @파일: app/api/search/route.ts
 * @설명: 매뉴얼 검색 API — 단순 부분일치(substring) 방식.
 *        Orama 기본 토크나이저는 한국어(교착어)를 어절 단위로만 색인해 "매뉴얼"처럼
 *        어미가 붙거나 부분만 입력한 검색이 비어 나온다. 문서 수가 많지 않아 제목·설명·문단을
 *        부분일치로 훑는 방식이 한국어에 더 정확하고 안정적이다.
 *        응답은 Fumadocs 기본 검색 UI가 기대하는 SortedResult[] 형식을 그대로 따르므로
 *        클라이언트 쪽 수정은 필요 없다(빈 검색어는 'empty' 반환).
 */
import { source } from '@/lib/source'
import { NextResponse } from 'next/server'
import type { SortedResult } from 'fumadocs-core/search'

// 매뉴얼 문서의 구조화 데이터(제목·문단) 형태
type StructuredData = {
  headings?: { id: string; content: string }[]
  contents?: { heading?: string; content: string }[]
}

/**
 * @함수명: GET
 * @설명: query 파라미터를 제목·설명·문단에서 부분일치로 찾아 SortedResult 목록으로 응답한다.
 * @매개변수: request - 검색어(query)를 담은 요청
 * @반환값: SortedResult[] (매칭 없음=빈 배열, 빈 검색어='empty')
 */
export function GET(request: Request): Response {
  const query = (new URL(request.url).searchParams.get('query') ?? '').trim()
  if (!query) return NextResponse.json('empty')

  const q = query.toLowerCase()
  const results: SortedResult[] = []

  for (const page of source.getPages()) {
    const url = page.url
    const title = page.data.title ?? ''
    const description = page.data.description ?? ''
    const sd: StructuredData | undefined =
      'structuredData' in page.data
        ? (page.data.structuredData as StructuredData)
        : undefined

    // 페이지 하위(제목·문단) 매칭 결과
    const sub: SortedResult[] = []
    let n = 0

    for (const h of sd?.headings ?? []) {
      if (h.content.toLowerCase().includes(q)) {
        sub.push({ id: `${url}-h${n++}`, url: `${url}#${h.id}`, type: 'heading', content: h.content })
      }
    }
    for (const c of sd?.contents ?? []) {
      if (c.content.toLowerCase().includes(q)) {
        sub.push({
          id: `${url}-t${n++}`,
          url: c.heading ? `${url}#${c.heading}` : url,
          type: 'text',
          content: c.content,
        })
      }
    }

    const pageMatched = title.toLowerCase().includes(q) || description.toLowerCase().includes(q)

    // 페이지 자체가 매칭되었거나 하위 매칭이 있으면, 그룹 헤더(page)와 하위 결과를 함께 추가
    if (pageMatched || sub.length > 0) {
      results.push({ id: url, url, type: 'page', content: title })
      results.push(...sub)
    }
  }

  return NextResponse.json(results)
}
