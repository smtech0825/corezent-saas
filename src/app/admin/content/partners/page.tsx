/**
 * @파일: admin/content/partners/page.tsx
 * @설명: Partners 섹션 콘텐츠 관리 (Phase 2)
 */

export const dynamic = 'force-dynamic'

export default function PartnersPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-serif text-ink">파트너</h1>
        <p className="text-sm text-ink-soft mt-1">
          랜딩 페이지에 표시되는 파트너 로고를 관리합니다.
        </p>
      </div>
      <div className="border border-dashed border-rule rounded-2xl py-20 text-center">
        <p className="text-ink-faint text-sm">파트너 관리는 Phase 2에서 제공될 예정입니다.</p>
      </div>
    </div>
  )
}
