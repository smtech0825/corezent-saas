/**
 * @파일: admin/tax/rules/page.tsx
 * @설명: 관리자 — 세금 룰 편집. 세목별 목록(시행일 순)과 등록·수정·상태 변경.
 *        레이아웃 가드 외에 페이지에서도 관리자 검증을 한 번 더 수행한다.
 */

import { requireAdminOrThrow } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import PageContainer from '@/components/common/PageContainer'
import type { TaxRule } from '@/lib/tax/types'
import TaxTabs from '../_components/TaxTabs'
import RulesManager from './RulesManager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '세금 룰 편집 — 관리자',
}

export default async function AdminTaxRulesPage() {
  await requireAdminOrThrow()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tax_rules')
    .select('*')
    .order('effective_from', { ascending: false })
    .order('rule_key', { ascending: true })
  if (error) console.error('[admin/tax] 룰 목록 조회 실패:', error.message)

  const rules = (data ?? []) as TaxRule[]

  return (
    <PageContainer variant="admin" className="space-y-5">
      <div>
        <h1 className="text-xl font-serif font-bold text-ink">세금 룰 관리</h1>
        <p className="text-sm text-ink-soft mt-1">
          세율·공제·기준액은 코드에 없습니다. 여기 등록된 룰이 계산기의 유일한 근거이므로,
          모든 룰에 법령명·조문·원문 링크를 반드시 남기세요.
        </p>
      </div>
      <TaxTabs active="rules" />
      <RulesManager rules={rules} />
    </PageContainer>
  )
}
