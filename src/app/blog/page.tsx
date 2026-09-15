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

/** 한 쪽에 보여줄 글 수 — 2열 격자라 12편이면 6줄로 떨어진다 */
const PER_PAGE = 12

const BASE_DESC = 'CoreZent 제품 소식과 업무 자동화 활용법을 전하는 블로그입니다.'

/**
 * @함수명: buildListUrl
 * @설명: 분류·쪽 번호를 담은 목록 주소를 만듭니다. 기본값(전체·1쪽)은 주소에 넣지 않아
 *        같은 화면이 여러 주소로 갈라지는 것을 막습니다.
 * @매개변수: category - 분류 이름(없으면 전체)
 * @매개변수: page - 쪽 번호(1이면 생략)
 * @반환값: '/blog' 또는 '/blog?category=…&page=…'
 */
function buildListUrl(category?: string, page = 1): string {
  const q = new URLSearchParams()
  if (category) q.set('category', category)
  if (page > 1) q.set('page', String(page))
  const s = q.toString()
  return s ? `/blog?${s}` : '/blog'
}

/**
 * @함수명: generateMetadata
 * @설명: 쪽·분류별 제목과 정식 주소를 만듭니다.
 *        ★ 2쪽 이후가 1쪽과 같은 정식 주소를 쓰면 검색엔진이 중복으로 보고 색인에서 뺍니다.
 *        쪽마다 자기 주소를 가리켜야 그 안의 글들이 발견됩니다.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>
}): Promise<Metadata> {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const category = sp.category?.trim() || undefined

  const parts = ['블로그']
  if (category) parts.push(category)
  if (page > 1) parts.push(`${page}쪽`)
  const title = parts.join(' · ')
  const url = `${SITE_URL}${buildListUrl(category, page)}`

  return {
    title,
    description: BASE_DESC,
    alternates: { canonical: url },
    openGraph: { title: `${title} | CoreZent`, description: BASE_DESC, url, type: 'website' },
  }
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
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const sp = await searchParams
  const active = sp.category

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
  const filtered = isValid ? all.filter((p) => p.data.category === active) : all

  // 쪽 나누기 — 글이 늘어도 한 화면에 전부 그리지 않는다.
  // 범위를 벗어난 쪽 번호가 들어오면 마지막 쪽으로 당긴다(빈 화면 방지).
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const page = Math.min(totalPages, Math.max(1, Number(sp.page) || 1))
  const posts = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const activeCategory = isValid ? active : undefined

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
                  href={buildListUrl(name)}
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

          {/* 쪽 이동 — 주소로 넘기므로 클라이언트 코드가 필요 없다.
              검색엔진이 링크를 따라가야 2쪽 이후 글도 발견하므로 <a>로 둔다(버튼 아님). */}
          {totalPages > 1 && (
            <nav aria-label="쪽 이동" className="mt-12 flex items-center justify-center gap-2">
              <Link
                href={buildListUrl(activeCategory, page - 1)}
                aria-disabled={page === 1}
                tabIndex={page === 1 ? -1 : undefined}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  page === 1
                    ? 'pointer-events-none border-rule text-ink-faint'
                    : 'border-rule text-ink-soft hover:border-pen/40 hover:text-ink'
                }`}
              >
                이전
              </Link>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={buildListUrl(activeCategory, n)}
                  aria-current={n === page ? 'page' : undefined}
                  className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                    n === page
                      ? 'border-pen bg-pen text-white'
                      : 'border-rule text-ink-soft hover:border-pen/40 hover:text-ink'
                  }`}
                >
                  {n}
                </Link>
              ))}

              <Link
                href={buildListUrl(activeCategory, page + 1)}
                aria-disabled={page === totalPages}
                tabIndex={page === totalPages ? -1 : undefined}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  page === totalPages
                    ? 'pointer-events-none border-rule text-ink-faint'
                    : 'border-rule text-ink-soft hover:border-pen/40 hover:text-ink'
                }`}
              >
                다음
              </Link>
            </nav>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
