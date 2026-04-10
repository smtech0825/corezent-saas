/**
 * @파일: admin/content/sections/page.tsx
 * @설명: 랜딩 페이지 섹션 가시성/순서 관리 — 초기 데이터 fetch 후 SectionsManager에 전달
 *        실제 DB 업데이트는 SectionsManager가 API 라우트를 통해 처리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import SectionsManager from './SectionsManager'

export const dynamic = 'force-dynamic'

// 기본 섹션 목록 (DB에 없을 경우 초기화용)
const defaultSections = [
  { name: 'hero',         label: 'Hero Section',         is_visible: true, order_index: 0 },
  { name: 'product',      label: 'Product Section',      is_visible: true, order_index: 1 },
  { name: 'how_it_works', label: 'How It Works Section', is_visible: true, order_index: 2 },
  { name: 'features',     label: 'Features Section',     is_visible: true, order_index: 3 },
  { name: 'pricing',      label: 'Pricing Section',      is_visible: true, order_index: 4 },
  { name: 'testimonials', label: 'Testimonials Section', is_visible: true, order_index: 5 },
  { name: 'faq',          label: 'FAQ Section',          is_visible: true, order_index: 6 },
  { name: 'cta',          label: 'CTA Section',          is_visible: true, order_index: 7 },
]

export default async function SectionsPage() {
  const adminClient = createAdminClient()

  const { data: dbSections } = await adminClient
    .from('front_sections')
    .select('name, label, is_visible, order_index')
    .order('order_index')

  // DB에 없는 섹션은 기본값으로 보완 후 order_index 기준 정렬
  const dbMap = new Map((dbSections ?? []).map((s) => [s.name, s]))
  const sections = defaultSections
    .map((def) => ({ ...def, ...(dbMap.get(def.name) ?? {}) }))
    .sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Section Settings</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Toggle visibility and drag to reorder landing page sections.
        </p>
      </div>

      <div className="border border-[#1E293B] bg-[#0B1120] rounded-2xl p-4">
        <p className="text-xs text-[#475569] mb-4 px-1">
          Drag sections to reorder them on the landing page. Changes are applied immediately.
        </p>
        <SectionsManager sections={sections} />
      </div>
    </div>
  )
}
