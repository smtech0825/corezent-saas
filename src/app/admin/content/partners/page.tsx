/**
 * @파일: admin/content/partners/page.tsx
 * @설명: Partners 섹션 콘텐츠 관리 (Phase 2)
 */

export const dynamic = 'force-dynamic'

export default function PartnersPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Partners</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Manage partner logos shown on the landing page.
        </p>
      </div>
      <div className="border border-dashed border-[#1E293B] rounded-2xl py-20 text-center">
        <p className="text-[#475569] text-sm">Partners management coming in Phase 2.</p>
      </div>
    </div>
  )
}
