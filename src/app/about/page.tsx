/**
 * @파일: app/about/page.tsx
 * @설명: About 페이지 — Hero, 통계 카드, 콘텐츠 블록(텍스트+이미지 슬라이더) — Admin 관리
 */

import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import DynamicIcon from '@/components/DynamicIcon'
import AboutBlockSlider from './AboutBlockSlider'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '회사소개',
  description: 'CoreZent를 소개합니다 — 우리는 누구이며, 무엇을 만들고, 왜 그것이 중요한지.',
}

export default async function AboutPage() {
  const c = createAdminClient()

  const [contentRes, statsRes, blocksRes] = await Promise.all([
    c.from('front_content').select('key, value').in('key', ['about_title', 'about_description']),
    c.from('front_about_stats').select('id, icon, value, label').eq('is_published', true).order('order_index'),
    c.from('front_about_blocks').select('id, title, description, images').eq('is_published', true).order('order_index'),
  ])

  const contentMap = Object.fromEntries((contentRes.data ?? []).map((r) => [r.key, r.value]))
  const title = contentMap['about_title'] || 'CoreZent 소개'
  const description = contentMap['about_description'] || ''
  const stats = statsRes.data ?? []
  const blocks = (blocksRes.data ?? []).map((b) => ({ ...b, images: (b.images ?? []) as string[] }))

  return (
    <div className="theme-paper min-h-screen bg-paper text-ink flex flex-col">
      <Navbar />

      <main className="flex-1 pt-10 sm:pt-14">
        {/* ─── Hero ─── */}
        <section className="relative px-4 sm:px-6 pb-20">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(29,63,176,0.05) 0%, transparent 70%)' }}
          />
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-serif font-black text-ink mb-6">{title}</h1>
            {description && (
              <div className="text-ink-soft text-lg leading-relaxed whitespace-pre-line">{description}</div>
            )}
          </div>
        </section>

        {/* ─── Stats Cards ─── */}
        {stats.length > 0 && (
          <section className="px-4 sm:px-6 pb-20">
            <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.map((s) => (
                <div
                  key={s.id}
                  className="border border-rule bg-paper-raised rounded-lg p-6 flex items-center gap-4 hover:border-pen/30 transition-colors shadow-[0_1px_2px_rgba(35,39,46,0.05)]"
                >
                  <div className="w-12 h-12 rounded-md bg-pen/10 border border-pen/20 flex items-center justify-center shrink-0">
                    <DynamicIcon name={s.icon || 'Users'} size={22} className="text-pen" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ink">{s.value}</p>
                    <p className="text-sm text-ink-soft">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Content Blocks (텍스트 + 이미지 슬라이더) ─── */}
        {blocks.map((block, idx) => (
          <section key={block.id} className="px-4 sm:px-6 pb-20">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              {/* 텍스트 — 홀수 블록은 오른쪽 배치 */}
              <div className={idx % 2 === 1 ? 'lg:order-2' : ''}>
                {block.title && (
                  <h2 className="text-2xl sm:text-3xl font-serif font-black text-ink mb-4">{block.title}</h2>
                )}
                {block.description && (
                  <div className="text-ink-soft text-sm sm:text-base leading-relaxed whitespace-pre-line">{block.description}</div>
                )}
              </div>

              {/* 이미지 슬라이더 */}
              {block.images.length > 0 && (
                <div className={idx % 2 === 1 ? 'lg:order-1' : ''}>
                  <AboutBlockSlider images={block.images} />
                </div>
              )}
            </div>
          </section>
        ))}

        {/* 콘텐츠가 아직 없을 때 안내 */}
        {stats.length === 0 && blocks.length === 0 && !description && (
          <div className="flex items-center justify-center py-20">
            <p className="text-ink-faint text-sm">회사소개 페이지 콘텐츠를 준비 중입니다.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
