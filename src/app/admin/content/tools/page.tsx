/**
 * @파일: admin/content/tools/page.tsx
 * @설명: Tools 섹션 콘텐츠 관리 (Phase 2 — 현재 플레이스홀더)
 */

export const dynamic = 'force-dynamic'

export default function ToolsPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Tools</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Manage tools/products shown in the Tools section on the landing page.
        </p>
      </div>

      <div className="border border-dashed border-[#1E293B] rounded-2xl py-20 text-center">
        <p className="text-[#475569] text-sm">Tools management coming in Phase 2.</p>
        <p className="text-xs text-[#1E293B] mt-1">
          Products are managed via the <a href="/admin/products" className="text-[#38BDF8] hover:underline">Products</a> page.
        </p>
      </div>
    </div>
  )
}
