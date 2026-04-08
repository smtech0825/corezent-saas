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
  title: 'About — CoreZent',
  description: 'Learn more about CoreZent — who we are, what we build, and why it matters.',
}

export default async function AboutPage() {
  const c = createAdminClient()

  const [contentRes, statsRes, blocksRes] = await Promise.all([
    c.from('front_content').select('key, value').in('key', ['about_title', 'about_description']),
    c.from('front_about_stats').select('id, icon, value, label').eq('is_published', true).order('order_index'),
    c.from('front_about_blocks').select('id, title, description, images').eq('is_published', true).order('order_index'),
  ])

  const contentMap = Object.fromEntries((contentRes.data ?? []).map((r) => [r.key, r.value]))
  const title = contentMap['about_title'] || 'About CoreZent'
  const description = contentMap['about_description'] || ''
  const stats = statsRes.data ?? []
  const blocks = (blocksRes.data ?? []).map((b) => ({ ...b, images: (b.images ?? []) as string[] }))

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28">
        {/* ─── Hero ─── */}
        <section className="relative px-6 pb-20">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(56,189,248,0.06) 0%, transparent 70%)' }}
          />
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">{title}</h1>
            {description && (
              <div className="text-[#94A3B8] text-lg leading-relaxed whitespace-pre-line">{description}</div>
            )}
          </div>
        </section>

        {/* ─── Stats Cards ─── */}
        {stats.length > 0 && (
          <section className="px-6 pb-20">
            <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.map((s) => (
                <div
                  key={s.id}
                  className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6 flex items-center gap-4 hover:border-[#38BDF8]/20 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center shrink-0">
                    <DynamicIcon name={s.icon || 'Users'} size={22} className="text-[#38BDF8]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{s.value}</p>
                    <p className="text-sm text-[#94A3B8]">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Content Blocks (텍스트 + 이미지 슬라이더) ─── */}
        {blocks.map((block, idx) => (
          <section key={block.id} className="px-6 pb-20">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              {/* 텍스트 — 홀수 블록은 오른쪽 배치 */}
              <div className={idx % 2 === 1 ? 'lg:order-2' : ''}>
                {block.title && (
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">{block.title}</h2>
                )}
                {block.description && (
                  <div className="text-[#94A3B8] text-sm sm:text-base leading-relaxed whitespace-pre-line">{block.description}</div>
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
            <p className="text-[#475569] text-sm">About page content is being prepared.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
