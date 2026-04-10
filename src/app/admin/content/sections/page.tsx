/**
 * @파일: admin/content/sections/page.tsx
 * @설명: 랜딩 페이지 섹션 가시성/순서 관리 — 초기 데이터 fetch 후 SectionsManager에 전달
 *        실제 DB 업데이트는 SectionsManager가 API 라우트를 통해 처리
 */

import { createAdminClient } from '@/lib/supabase/admin'
import SectionsManager from './SectionsManager'

export const dynamic = 'force-dynamic'

// 기본 섹션 목록 — label은 코드 값을 정본으로 사용 (DB 값 무시)
const defaultSections = [
  { name: 'hero',         label: 'Hero',          is_visible: true, order_index: 0 },
  { name: 'product',      label: 'Product',       is_visible: true, order_index: 1 },
  { name: 'how_it_works', label: 'How It Works',  is_visible: true, order_index: 2 },
  { name: 'features',     label: 'Features',      is_visible: true, order_index: 3 },
  { name: 'pricing',      label: 'Pricing',       is_visible: true, order_index: 4 },
  { name: 'testimonials', label: 'Testimonials',  is_visible: true, order_index: 5 },
  { name: 'faq',          label: 'FAQ',           is_visible: true, order_index: 6 },
  { name: 'cta',          label: 'CTA',           is_visible: true, order_index: 7 },
]

export default async function SectionsPage() {
  const adminClient = createAdminClient()

  // label은 DB 값 대신 코드의 defaultSections를 정본으로 사용 (구 한글 레이블 방지)
  const { data: dbSections } = await adminClient
    .from('front_sections')
    .select('name, is_visible, order_index')
    .order('order_index')

  const dbMap = new Map((dbSections ?? []).map((s) => [s.name, s]))
  const sections = defaultSections
    .map((def) => {
      const db = dbMap.get(def.name)
      return {
        ...def,                                                  // label은 코드 값 사용
        is_visible:  db ? db.is_visible  : def.is_visible,      // DB 가시성 우선
        order_index: db ? db.order_index : def.order_index,     // DB 순서 우선
      }
    })
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
