/**
 * @파일: app/blog/page.tsx
 * @설명: 블로그 목록 — 카드형(제목·날짜·설명·태그), 최신순. 마케팅 사이트 톤(Navbar/Footer·페이퍼 테마).
 *        글은 content/blog의 MDX에서 동적으로 읽으므로 글 추가 시 코드 수정이 필요 없다.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { blog } from '@/lib/source'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: '블로그',
  description: 'CoreZent 제품 소식과 업무 자동화 활용법을 전하는 블로그입니다.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: '블로그 | CoreZent',
    description: 'CoreZent 제품 소식과 업무 자동화 활용법을 전하는 블로그입니다.',
    url: `${SITE_URL}/blog`,
    type: 'website',
  },
}

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
 * @함수명: BlogListPage
 * @설명: 블로그 글을 최신순 카드 그리드로 보여주는 목록 페이지.
 */
export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category: active } = await searchParams

  // 최신순 정렬(date 내림차순)
  const all = [...blog.getPages()].sort(
    (a, b) => (a.data.date < b.data.date ? 1 : a.data.date > b.data.date ? -1 : 0),
  )

  // 카테고리 목록은 글에서 뽑는다 — 새 카테고리를 쓰면 탭이 저절로 생긴다(코드 수정 불필요).
  // 글 수가 많은 순으로 놓아 빈 탭이 앞에 오지 않게 한다.
  const counts = new Map<string, number>()
  all.forEach((p) => {
    const c = p.data.category
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  })
  const categories = [...counts.entries()].sort((a, b) => b[1] - a[1])

  // 목록에 없는 값이 주소로 들어오면 거르지 않고 전체를 보여준다(빈 화면 방지)
  const isValid = active ? counts.has(active) : false
  const posts = isValid ? all.filter((p) => p.data.category === active) : all

  return (
    <div className="theme-paper min-h-screen bg-paper text-ink flex flex-col">
      <Navbar />

      <main className="flex-1 pt-10 sm:pt-14 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <header className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-serif font-black text-ink mb-4">블로그</h1>
            <p className="text-ink-soft text-lg">제품 소식과 업무 자동화 활용법을 전합니다.</p>
          </header>

          {/* 카테고리 탭 — 주소로 거르므로 클라이언트 코드가 필요 없다 */}
          {categories.length > 0 && (
            <nav aria-label="카테고리" className="mb-10 flex flex-wrap justify-center gap-2">
              <Link
                href="/blog"
                aria-current={!isValid ? 'page' : undefined}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  !isValid
                    ? 'border-pen bg-pen text-white'
                    : 'border-rule text-ink-soft hover:border-pen/40 hover:text-ink'
                }`}
              >
                전체 {all.length}
              </Link>
              {categories.map(([name, n]) => (
                <Link
                  key={name}
                  href={`/blog?category=${encodeURIComponent(name)}`}
                  aria-current={active === name ? 'page' : undefined}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    active === name
                      ? 'border-pen bg-pen text-white'
                      : 'border-rule text-ink-soft hover:border-pen/40 hover:text-ink'
                  }`}
                >
                  {name} {n}
                </Link>
              ))}
            </nav>
          )}

          {posts.length === 0 ? (
            <p className="text-center text-ink-faint py-20">아직 게시된 글이 없습니다.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {posts.map((post) => (
                <Link
                  key={post.url}
                  href={post.url}
                  className="group block rounded-2xl border border-rule bg-paper-raised p-6 transition-all hover:border-pen/50 hover:-translate-y-0.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {post.data.category && (
                      <span className="rounded-full border border-pen/30 bg-pen/5 px-2 py-0.5 text-xs font-medium text-pen">
                        {post.data.category}
                      </span>
                    )}
                    <time dateTime={post.data.date} className="text-xs text-ink-faint">
                      {formatDate(post.data.date)}
                    </time>
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-ink transition-colors group-hover:text-pen">
                    {post.data.title}
                  </h2>
                  {post.data.description && (
                    <p className="mt-2 text-sm text-ink-soft line-clamp-3">{post.data.description}</p>
                  )}
                  {post.data.tags && post.data.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {post.data.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-paper-shade px-2.5 py-1 text-xs text-ink-soft"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
