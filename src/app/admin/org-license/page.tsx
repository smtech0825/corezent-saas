/**
 * @파일: admin/org-license/page.tsx
 * @설명: 기관 라이선스 발급 — 계좌이체(수기 계약) 기관용 SQL 만들기 화면.
 *        관리자 확인은 admin 레이아웃(role=admin)이 담당한다(다른 관리자 화면과 동일).
 *        ⚠️ 이 화면(Wave 1)은 어떤 DB에도 쓰지 않는다 — SQL을 만들어 복사만 제공하고,
 *        실행은 대표님이 지니워크 라이선스 프로젝트(ecltbezstxufivhbhsjp)에서 직접 한다.
 */

import PageContainer from '@/components/common/PageContainer'
import OrgIssueClient from './OrgIssueClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '기관 라이선스 발급',
}

export default function OrgLicensePage() {
  return (
    <PageContainer variant="admin" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-ink">기관 라이선스 발급</h1>
        <p className="text-sm text-ink-soft mt-1">
          칸을 채우면 등록 SQL이 만들어집니다 · 지니워크 라이선스 프로젝트에서 실행하십시오
        </p>
      </div>
      <OrgIssueClient />
    </PageContainer>
  )
}
