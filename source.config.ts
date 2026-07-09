/**
 * @파일: source.config.ts
 * @설명: Fumadocs 콘텐츠 컬렉션 정의(단일 파이프라인).
 *        - docs : content/docs 하위 MDX → /docs 매뉴얼(사이드바 트리 + meta.json 지원)
 *        - blog : content/blog 하위 MDX → /blog 블로그(Wave 3에서 사용)
 *        MDX 파일만 추가하면 코드 수정 없이 페이지/글이 늘어나는 파일 기반 구조를 유지한다.
 */
import {
  defineDocs,
  defineConfig,
  defineCollections,
  frontmatterSchema,
} from 'fumadocs-mdx/config'
import { z } from 'zod'

// 매뉴얼(docs) 컬렉션 — 기본 frontmatter(title·description) + meta.json으로 섹션 순서 제어
export const docs = defineDocs({
  dir: 'content/docs',
})

// 블로그(blog) 컬렉션 — 목록/상세에 필요한 date·tags 프론트매터를 추가로 정의
// date는 따옴표 없이 쓰면 YAML이 Date로 파싱하므로, 문자열/Date 모두 받아 'YYYY-MM-DD' 문자열로 정규화한다
// (앞으로 글을 추가할 때 date 표기 방식에 신경 쓰지 않아도 되도록 — 보편 해결)
export const blog = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  schema: frontmatterSchema.extend({
    date: z
      .union([z.string(), z.date()])
      .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v)),
    tags: z.array(z.string()).optional(),
  }),
})

export default defineConfig()
