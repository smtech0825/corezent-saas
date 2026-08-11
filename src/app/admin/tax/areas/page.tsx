/**
 * @파일: admin/tax/areas/page.tsx
 * @설명: 관리자 — 규제지역(조정대상지역·투기과열지구) 이력 입력·조회.
 *        국토교통부 공고를 근거로 사람이 직접 입력한다(코드에 지역 목록을 넣지 않는 원칙).
 */

import { requireAdminOrThrow } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import PageContainer from '@/components/common/PageContainer'
import type { TaxRegulatedArea } from '@/lib/tax/types'
import TaxTabs from '../_components/TaxTabs'
import AreasManager from './AreasManager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '규제지역 관리 — 관리자',
}

export default async function AdminTaxAreasPage() {
  await requireAdminOrThrow()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tax_regulated_areas')
    .select('*')
    .order('designated_from', { ascending: false })
    .order('region_code', { ascending: true })
  if (error) console.error('[admin/tax] 규제지역 목록 조회 실패:', error.message)

  const areas = (data ?? []) as TaxRegulatedArea[]

  return (
    <PageContainer variant="admin" className="space-y-5">
      <div>
        <h1 className="text-xl font-serif font-bold text-ink">규제지역 관리</h1>
        <p className="text-sm text-ink-soft mt-1">
          조정대상지역·투기과열지구 지정/해제 이력을 국토교통부 공고 근거와 함께 입력합니다.
          소재지는 계산기와 같은 행정구역 목록에서 선택되므로 판정 코드가 어긋나지 않습니다.
        </p>
      </div>
      <TaxTabs active="areas" />
      <AreasManager areas={areas} />
    </PageContainer>
  )
}
