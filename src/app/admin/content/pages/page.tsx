/**
 * @파일: admin/content/pages/page.tsx
 * @설명: 정적 페이지(Privacy Policy, Terms) 편집 (Phase 2)
 */

export const dynamic = 'force-dynamic'

export default function PagesPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Pages</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Edit static pages: Privacy Policy, Terms of Service, About.
        </p>
      </div>
      <div className="border border-dashed border-[#1E293B] rounded-2xl py-20 text-center">
        <p className="text-[#475569] text-sm">Page editor coming in Phase 2.</p>
      </div>
    </div>
  )
}
