/**
 * @파일: lib/source.ts
 * @설명: Fumadocs 콘텐츠 로더.
 *        - source : 매뉴얼(docs) — baseUrl '/docs' (사이드바 트리·검색)
 *        - blog   : 블로그(blog) — baseUrl '/blog' (목록·상세)
 *        생성물 `.source`는 저장소 루트의 빌드 산출물이라 상대경로로 참조한다.
 *        (이 저장소는 `@/*` → `src/*` 매핑이라 `@/.source` 별칭을 쓸 수 없다)
 */
import { docs, blog as blogPosts } from '../../.source'
import { loader } from 'fumadocs-core/source'
import { createMDXSource } from 'fumadocs-mdx'

/** 매뉴얼 소스 — /docs 세그먼트(레이아웃·페이지·검색 API)가 공통으로 사용한다 */
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
})

/** 블로그 소스 — /blog 목록·상세, sitemap이 사용한다 */
export const blog = loader({
  baseUrl: '/blog',
  source: createMDXSource(blogPosts),
})
