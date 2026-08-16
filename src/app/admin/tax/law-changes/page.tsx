/**
 * @파일: admin/tax/law-changes/page.tsx
 * @설명: 관리자 — 법제처 OPEN API가 감지한 법령 개정 목록.
 *        감지만 하고 룰을 자동으로 고치지는 않는다. 무엇을 어떻게 고칠지는
 *        사람이 조문을 대조해 판단한다(조문번호가 조 단위라 항을 구분하지 못한다).
 *
 *        배치 실행 상태(마지막 실행 시각·성공 여부)도 함께 보여준다 —
 *        배치가 조용히 죽으면 큐가 비어 있는 것과 구분되지 않기 때문이다.
 */

import { requireAdminOrThrow } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import PageContainer from '@/components/common/PageContainer'
import type { TaxLawChangeQueueItem, TaxLawWatchState, TaxRule } from '@/lib/tax/types'
import TaxTabs from '../_components/TaxTabs'
import { fetchPendingLawChangeCount } from '../_components/pending-count'
import LawChangesManager, { type LawChangeRow } from './LawChangesManager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '법령 개정 감지 — 관리자',
}

/** 국가법령정보센터 신구법 비교 화면 주소 — 인증키 없이 열리는 공개 화면 */
function oldAndNewLink(lawId: string | null): string | null {
  if (!lawId) return null
  return `https://www.law.go.kr/lsSc.do?menuId=1&query=&lsId=${encodeURIComponent(lawId)}#AJAX`
}

export default async function AdminTaxLawChangesPage() {
  await requireAdminOrThrow()

  const admin = createAdminClient()

  // 미확인을 먼저, 그 안에서 최근 순. status 문자열을 그냥 오름차순으로 정렬하면
  // ignored < pending < reviewed 순이 되어 '해당 없음'이 맨 위로 온다 —
  // 이 화면의 존재 이유(미확인을 눈에 띄게)와 정반대다. 그래서 두 번 나눠 읽는다.
  // raw_payload는 화면이 쓰지 않으므로 select에서 제외한다(브라우저까지 실려 가지 않게).
  const QUEUE_COLUMNS =
    'id, law_name, law_id, article_no, detected_at, effective_date, change_type, status, reviewed_at, matched_rule_keys'
  const [pendingRes, doneRes, stateRes, rulesRes, pendingCount] = await Promise.all([
    admin
      .from('tax_law_change_queue')
      .select(QUEUE_COLUMNS)
      .eq('status', 'pending')
      .order('detected_at', { ascending: false })
      .limit(100),
    admin
      .from('tax_law_change_queue')
      .select(QUEUE_COLUMNS)
      .neq('status', 'pending')
      .order('detected_at', { ascending: false })
      .limit(100),
    admin.from('tax_law_watch_state').select('*').eq('id', 1).maybeSingle(),
    admin
      .from('tax_rules')
      .select('rule_key, status, tax_type, law_name, law_article, law_id, law_article_no')
      .range(0, 4999),
    fetchPendingLawChangeCount(),
  ])
  const queueRes = {
    data: [...(pendingRes.data ?? []), ...(doneRes.data ?? [])],
    error: pendingRes.error ?? doneRes.error,
  }

  if (queueRes.error) console.error('[admin/tax] 개정 큐 조회 실패:', queueRes.error.message)
  if (stateRes.error) console.error('[admin/tax] 감시 상태 조회 실패:', stateRes.error.message)
  if (rulesRes.error) console.error('[admin/tax] 룰 조회 실패:', rulesRes.error.message)

  const items = (queueRes.data ?? []) as unknown as TaxLawChangeQueueItem[]
  const watchState = (stateRes.data ?? null) as TaxLawWatchState | null
  const rules = (rulesRes.data ?? []) as Pick<
    TaxRule,
    'rule_key' | 'status' | 'tax_type' | 'law_name' | 'law_article' | 'law_id' | 'law_article_no'
  >[]

  // 감시할 수 없는 룰(법령ID·조문번호가 비어 있음) — 잘못된 ID만 경고하고 빈 ID는
  // 무표시라면 초록불만 보고 안심하게 된다. 룰 목록 화면에는 이 값이 보이지 않는다.
  // 같은 룰 키가 시행 기간별로 여러 행이라 키 기준으로 한 번만 담는다.
  const unwatchable = [
    ...new Map(
      rules
        .filter((r) => !r.law_id?.trim() || !r.law_article_no?.trim())
        .map((r) => [
          r.rule_key,
          {
            ruleKey: r.rule_key,
            lawName: r.law_name,
            reason: !r.law_id?.trim() ? ('법령ID 없음' as const) : ('조문번호 없음' as const),
          },
        ]),
    ).values(),
  ]

  // rule_key → 그 키를 쓰는 룰 행들. 같은 키에 확정법·개정안이 함께 있을 수 있어
  // 화면이 둘을 구분해 보여줄 수 있도록 상태별로 모아 넘긴다.
  const rows: LawChangeRow[] = items.map((item) => ({
    item,
    matchedRules: (item.matched_rule_keys ?? []).map((key) => {
      const found = rules.filter((r) => r.rule_key === key)
      return {
        ruleKey: key,
        confirmedCount: found.filter((r) => r.status === 'confirmed').length,
        proposedCount: found.filter((r) => r.status === 'proposed').length,
        taxType: found[0]?.tax_type ?? null,
        lawArticle: found[0]?.law_article ?? null,
      }
    }),
    oldAndNewUrl: oldAndNewLink(item.law_id),
  }))

  return (
    <PageContainer variant="admin" className="space-y-5">
      <div>
        <h1 className="text-xl font-serif font-bold text-ink">법령 개정 감지</h1>
        <p className="text-sm text-ink-soft mt-1">
          등록된 룰의 근거 조문이 바뀌면 여기에 쌓입니다. 룰은 자동으로 고쳐지지 않습니다 —
          무엇이 어떻게 바뀌었는지 원문을 대조하고, 고칠 값은 룰 편집 화면에서 직접 넣습니다.
        </p>
      </div>
      <TaxTabs active="law-changes" pendingLawChanges={pendingCount} />
      <LawChangesManager
        rows={rows}
        watchState={watchState}
        unwatchable={unwatchable}
        pendingCount={pendingCount}
        loadError={queueRes.error ? '개정 목록을 불러오지 못했습니다. 화면의 건수가 실제와 다를 수 있습니다.' : null}
      />
    </PageContainer>
  )
}
