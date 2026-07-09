/**
 * @파일: app/blog/[slug]/page.tsx
 * @설명: 블로그 상세 — 마케팅 사이트 톤(Navbar/Footer·페이퍼 테마). 본문은 기존 사이트의
 *        .rich-content prose 스타일로 렌더해 상품 설명·소개 페이지와 동일한 브랜드 타이포를 유지한다.
 *        정적 파라미터/메타데이터(OG·canonical)는 컬렉션에서 자동 생성한다.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { blog } from '@/lib/source'
import { SITE_URL } from '@/lib/site'

type BlogPostProps = { params: Promise<{ slug: string }> }

/**
 * @함수명: formatDate
 * @설명: 'YYYY-MM-DD' 문자열을 'YYYY년 M월 D일'로 표시(타임존 영향 없이 문자열 파싱).
 */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

/**
 * @함수명: generateStaticParams
 * @설명: 모든 블로그 글의 slug를 정적 생성한다(글 추가 시 코드 수정 불필요).
 */
export function generateStaticParams() {
  return blog.getPages().map((post) => ({ slug: post.slugs[0] }))
}

/**
 * @함수명: generateMetadata
 * @설명: 글별 title·description·OpenGraph·canonical(자체 도메인) 메타데이터를 생성한다.
 */
export async function generateMetadata(props: BlogPostProps): Promise<Metadata> {
  const { slug } = await props.params
  const page = blog.getPage([slug])
  if (!page) return {}

  const url = `${SITE_URL}/blog/${slug}`
  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: url },
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url,
      type: 'article',
      publishedTime: page.data.date,
    },
  }
}

/**
 * @함수명: BlogPostPage
 * @설명: slug에 해당하는 블로그 글을 마케팅 톤 레이아웃 + .rich-content prose로 렌더한다. 없으면 404.
 * @매개변수: props.params - 글 slug(Promise)
 */
export default async function BlogPostPage(props: BlogPostProps) {
  const { slug } = await props.params
  const page = blog.getPage([slug])
  if (!page) notFound()

  const MDX = page.data.body

  return (
    <div className="theme-paper min-h-screen bg-paper text-ink flex flex-col">
      <Navbar />

      <main className="flex-1 pt-10 sm:pt-14 pb-20 px-4 sm:px-6">
        <article className="max-w-3xl mx-auto">
          <header className="mb-8 border-b border-rule pb-6">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-ink-faint">
              <time dateTime={page.data.date}>{formatDate(page.data.date)}</time>
              {page.data.tags && page.data.tags.length > 0 && (
                <span className="flex flex-wrap gap-2">
                  {page.data.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-paper-shade px-2.5 py-1 text-xs text-ink-soft">
                      {tag}
                    </span>
                  ))}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-black leading-tight text-ink">
              {page.data.title}
            </h1>
            {page.data.description && (
              <p className="mt-4 text-lg text-ink-soft">{page.data.description}</p>
            )}
          </header>

          {/* 본문 — 기존 사이트와 동일한 .rich-content 브랜드 prose(문서 사이드바 UI 아님) */}
          <div className="rich-content text-base leading-7">
            <MDX components={{}} />
          </div>

          <div className="mt-12 border-t border-rule pt-6">
            <Link href="/blog" className="text-sm text-pen transition-colors hover:text-pen-dark">
              ← 블로그 목록으로
            </Link>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}
