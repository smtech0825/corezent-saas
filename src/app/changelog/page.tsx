/**
 * @파일: changelog/page.tsx
 * @설명: 제품별 변경 이력 페이지 — 로그인 필수
 *        좌측: 상품 사이드바 | 우측: 버전 타임라인
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Tag, ArrowLeft } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Changelog — CoreZent',
  description: 'Version history and release notes for CoreZent products.',
}

interface Changelog {
  id: string
  version: string
  release_date: string
  is_latest: boolean
  download_urls: Record<string, string>
  content: {
    new_features:     string[]
    improvements:     string[]
    bug_fixes:        string[]
    breaking_changes: string[]
  }
}

interface Product {
  id: string
  name: string
  slug: string
  logo_url: string | null
  changelogs: Changelog[]
}

const CONTENT_SECTIONS = [
  { key: 'new_features'     as const, label: 'New Features',     badge: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20' },
  { key: 'improvements'     as const, label: 'Improvements',     badge: 'text-violet-400 bg-violet-400/10 border-violet-400/20' },
  { key: 'bug_fixes'        as const, label: 'Bug Fixes',        badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  { key: 'breaking_changes' as const, label: 'Breaking Changes', badge: 'text-red-400 bg-red-400/10 border-red-400/20' },
]

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/changelog')

  // changelog가 있는 상품 목록 + 버전 조회
  const { data: raw } = await supabase
    .from('changelogs')
    .select('id, product_id, version, release_date, is_latest, download_urls, content, products(id, name, slug, logo_url)')
    .order('release_date', { ascending: false })

  // 상품별로 그룹화
  const productMap = new Map<string, Product>()
  ;(raw ?? []).forEach((row: any) => {
    const p = row.products
    if (!p) return
    if (!productMap.has(p.id)) {
      productMap.set(p.id, {
        id: p.id, name: p.name, slug: p.slug, logo_url: p.logo_url, changelogs: [],
      })
    }
    productMap.get(p.id)!.changelogs.push({
      id:            row.id,
      version:       row.version,
      release_date:  row.release_date,
      is_latest:     row.is_latest,
      download_urls: row.download_urls ?? {},
      content: {
        new_features:     row.content?.new_features     ?? [],
        improvements:     row.content?.improvements     ?? [],
        bug_fixes:        row.content?.bug_fixes        ?? [],
        breaking_changes: row.content?.breaking_changes ?? [],
      },
    })
  })

  const products = [...productMap.values()]

  const { product: selectedSlug } = await searchParams
  const selectedProduct = selectedSlug
    ? products.find((p) => p.slug === selectedSlug) ?? products[0]
    : products[0]

  if (products.length === 0) {
    return (
      <div className="min-h-screen bg-[#0B1120] font-sans">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-[#475569] text-sm">No changelog entries yet.</p>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B1120] font-sans">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-10 flex gap-8">

        {/* 사이드바 — 상품 목록 */}
        <aside className="w-56 shrink-0 hidden md:block">
          <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-4 px-2">Products</p>
          <nav className="space-y-1">
            {products.map((p) => {
              const isActive = p.id === selectedProduct?.id
              return (
                <Link
                  key={p.id}
                  href={`/changelog?product=${p.slug}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    isActive
                      ? 'bg-[#38BDF8]/10 text-white border border-[#38BDF8]/20'
                      : 'text-[#475569] hover:text-[#94A3B8] hover:bg-[#111A2E]'
                  }`}
                >
                  {p.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logo_url} alt="" className="w-6 h-6 rounded-md object-contain shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-md bg-[#1E293B] flex items-center justify-center shrink-0">
                      <Tag size={11} className="text-[#475569]" />
                    </div>
                  )}
                  <span className="truncate font-medium">{p.name}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* 메인 — 타임라인 */}
        <main className="flex-1 min-w-0">
          {/* 홈으로 돌아가기 */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#94A3B8] transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Home
            </Link>
          </div>

          {/* 모바일 상품 선택 */}
          <div className="md:hidden mb-6">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {products.map((p) => {
                const isActive = p.id === selectedProduct?.id
                return (
                  <Link
                    key={p.id}
                    href={`/changelog?product=${p.slug}`}
                    className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/20'
                        : 'text-[#475569] border-[#1E293B] hover:text-[#94A3B8]'
                    }`}
                  >
                    {p.name}
                  </Link>
                )
              })}
            </div>
          </div>

          {selectedProduct && (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">{selectedProduct.name}</h1>
                <p className="text-sm text-[#475569] mt-1">Release notes and version history</p>
              </div>

              {/* 타임라인 */}
              <div className="relative">
                {/* 세로 줄 */}
                <div className="absolute left-[7px] top-2 bottom-0 w-px bg-[#1E293B]" />

                <div className="space-y-10">
                  {selectedProduct.changelogs.map((cl) => {
                    const hasAnyContent =
                      cl.content.new_features.length > 0 ||
                      cl.content.improvements.length > 0 ||
                      cl.content.bug_fixes.length > 0 ||
                      cl.content.breaking_changes.length > 0

                    const platforms = Object.entries(cl.download_urls).filter(([, url]) => url)

                    return (
                      <div key={cl.id} className="flex gap-6">
                        {/* 점 */}
                        <div className={`mt-1 w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10 ${
                          cl.is_latest
                            ? 'bg-[#38BDF8] border-[#38BDF8]'
                            : 'bg-[#0B1120] border-[#1E293B]'
                        }`} />

                        {/* 카드 */}
                        <div className="flex-1 min-w-0 pb-2">
                          {/* 버전 헤더 */}
                          <div className="flex items-center gap-3 flex-wrap mb-4">
                            <span className="text-lg font-bold text-white font-mono">{cl.version}</span>
                            {cl.is_latest && (
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20">
                                Latest
                              </span>
                            )}
                            <span className="text-sm text-[#475569]">
                              {new Date(cl.release_date).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'long', day: 'numeric',
                              })}
                            </span>
                          </div>

                          {/* 다운로드 링크 */}
                          {platforms.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                              {platforms.map(([platform, url]) => (
                                <a
                                  key={platform}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-400/30 hover:border-emerald-400/60 px-3 py-2.5 rounded-lg transition-colors min-h-[44px]"
                                >
                                  ↓ {PLATFORM_LABEL[platform] ?? platform}
                                </a>
                              ))}
                            </div>
                          )}

                          {/* 변경 내용 */}
                          {hasAnyContent && (
                            <div className="bg-[#111A2E] border border-[#1E293B] rounded-xl overflow-hidden divide-y divide-[#1E293B]/60">
                              {CONTENT_SECTIONS.map(({ key, label, badge }) => {
                                const items = cl.content[key]
                                if (items.length === 0) return null
                                return (
                                  <div key={key} className="px-5 py-4">
                                    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border mb-3 ${badge}`}>
                                      {label}
                                    </span>
                                    <ul className="space-y-1.5">
                                      {items.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-[#94A3B8]">
                                          <span className="mt-1.5 w-1 h-1 rounded-full bg-[#475569] shrink-0" />
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {!hasAnyContent && (
                            <p className="text-sm text-[#475569] italic">No release notes for this version.</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      <Footer />
    </div>
  )
}

const PLATFORM_LABEL: Record<string, string> = {
  windows:      'Windows',
  mac:          'macOS',
  linux:        'Linux',
  chrome_store: 'Chrome Store',
  web:          'Web',
}
