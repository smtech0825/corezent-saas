/**
 * @파일: admin/content/tools/page.tsx
 * @설명: Tools 섹션 콘텐츠 관리 (Phase 2 — 현재 플레이스홀더)
 */

export const dynamic = 'force-dynamic'

export default function ToolsPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">도구</h1>
        <p className="text-sm text-[#E2E8F0] mt-1">
          랜딩 페이지의 도구 섹션에 표시되는 도구/제품을 관리합니다.
        </p>
      </div>

      <div className="border border-dashed border-[#1E293B] rounded-2xl py-20 text-center">
        <p className="text-[#94A3B8] text-sm">도구 관리는 Phase 2에서 제공될 예정입니다.</p>
        <p className="text-xs text-[#1E293B] mt-1">
          제품은 <a href="/admin/products" className="text-[#38BDF8] hover:underline">제품</a> 페이지에서 관리됩니다.
        </p>
      </div>
    </div>
  )
}
