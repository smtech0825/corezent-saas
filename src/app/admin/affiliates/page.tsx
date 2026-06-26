/**
 * @파일: admin/affiliates/page.tsx
 * @설명: 제휴 관리(관리자) — 프로그램 설정 편집, 검토 필요 커미션, 제휴자 목록·전환·할인 발급.
 *        데이터 집계는 서버에서 수행, 변경은 서버 액션(actions.ts) + 030 원자 RPC 경유.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getAffiliateConfig } from '@/lib/affiliate'
import ConfigEditor from './ConfigEditor'
import { ConvertButton, IssueDiscountForm, ResolveButton } from './AffiliateActions'

export const dynamic = 'force-dynamic'

export const metadata = { title: '제휴 관리 — CoreZent Admin' }

/** 정수 cents → $ 표시 */
function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

type Agg = { pendingEligible: number; pendingHeld: number; approved: number; paid: number; reversed: number }

export default async function AdminAffiliatesPage() {
  const admin = createAdminClient()

  const [cfg, { data: commissionsRaw }, { data: ledgerRaw }] = await Promise.all([
    getAffiliateConfig(),
    admin.from('affiliate_commissions')
      .select('id, referrer_user_id, status, commission_amount_cents, available_at, needs_admin_review, review_reason'),
    admin.from('store_credit_ledger').select('user_id, delta_cents'),
  ])

  const commissions = (commissionsRaw ?? []) as Array<{
    id: string; referrer_user_id: string; status: string; commission_amount_cents: number
    available_at: string; needs_admin_review: boolean; review_reason: string | null
  }>
  const ledger = (ledgerRaw ?? []) as Array<{ user_id: string; delta_cents: number }>

  const now = Date.now()
  const aggByRef = new Map<string, Agg>()
  for (const c of commissions) {
    const a = aggByRef.get(c.referrer_user_id) ?? { pendingEligible: 0, pendingHeld: 0, approved: 0, paid: 0, reversed: 0 }
    const cents = c.commission_amount_cents ?? 0
    if (c.status === 'pending') {
      if (new Date(c.available_at).getTime() <= now) a.pendingEligible += cents
      else a.pendingHeld += cents
    } else if (c.status === 'approved') a.approved += cents
    else if (c.status === 'paid') a.paid += cents
    else if (c.status === 'reversed') a.reversed += cents
    aggByRef.set(c.referrer_user_id, a)
  }

  const balByUser = new Map<string, number>()
  for (const l of ledger) balByUser.set(l.user_id, (balByUser.get(l.user_id) ?? 0) + (l.delta_cents ?? 0))

  const refIds = [...aggByRef.keys()]
  const { data: profsRaw } = refIds.length
    ? await admin.from('profiles').select('id, name, affiliate_code').in('id', refIds)
    : { data: [] as Array<{ id: string; name: string | null; affiliate_code: string | null }> }
  const profMap = new Map((profsRaw ?? []).map((p) => [p.id, p]))

  const affiliates = refIds
    .map((id) => ({
      referrerId: id,
      name: profMap.get(id)?.name ?? '(이름 없음)',
      code: profMap.get(id)?.affiliate_code ?? '—',
      ...(aggByRef.get(id) as Agg),
      balanceCents: balByUser.get(id) ?? 0,
    }))
    .sort((a, b) => b.pendingEligible - a.pendingEligible)

  const flagged = commissions
    .filter((c) => c.needs_admin_review)
    .map((c) => ({
      id: c.id,
      referrerName: profMap.get(c.referrer_user_id)?.name ?? c.referrer_user_id.slice(0, 8),
      amountCents: c.commission_amount_cents ?? 0,
      reason: c.review_reason ?? '',
    }))

  const minDollars = cfg ? (cfg.min_payout_credit / 100).toFixed(2) : '50.00'

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">제휴 관리</h1>
        <p className="text-sm text-[#94A3B8] mt-1">프로그램 규칙 설정, 커미션 전환, 어뷰징 검토, 크레딧 할인 발급.</p>
      </div>

      {/* 설정 편집기 */}
      {cfg ? (
        <ConfigEditor
          minPayoutDollars={minDollars}
          initial={{
            program_enabled:       cfg.program_enabled,
            commission_type:       cfg.commission_type,
            commission_value:      cfg.commission_value,
            is_recurring:          cfg.is_recurring,
            recurring_months_cap:  cfg.recurring_months_cap,
            cookie_days:           cfg.cookie_days,
            hold_days:             cfg.hold_days,
            min_payout_credit:     cfg.min_payout_credit,
            currency:              cfg.currency,
            self_referral_blocked: cfg.self_referral_blocked,
          }}
        />
      ) : (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
          affiliate_program_config를 불러오지 못했습니다(028 적용 여부 확인).
        </div>
      )}

      {/* 검토 필요 */}
      <section>
        <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">
          검토 필요{flagged.length > 0 && <span className="ml-2 normal-case text-[#475569] font-normal">({flagged.length}건)</span>}
        </h2>
        {flagged.length > 0 ? (
          <div className="bg-[#111A2E] border border-[#1E293B] rounded-2xl divide-y divide-[#1E293B]/60">
            {flagged.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-white">{f.referrerName} · <span className="font-mono text-red-400">{usd(f.amountCents)}</span></p>
                  <p className="text-xs text-[#475569] truncate">{f.reason}</p>
                </div>
                <ResolveButton commissionId={f.id} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#475569] bg-[#111A2E] border border-[#1E293B] rounded-2xl px-5 py-6 text-center">검토할 항목이 없습니다.</p>
        )}
      </section>

      {/* 제휴자 목록 */}
      <section>
        <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">
          제휴자{affiliates.length > 0 && <span className="ml-2 normal-case text-[#475569] font-normal">({affiliates.length}명)</span>}
        </h2>
        {affiliates.length > 0 ? (
          <div className="bg-[#111A2E] border border-[#1E293B] rounded-2xl overflow-hidden divide-y divide-[#1E293B]/60">
            {affiliates.map((a) => (
              <div key={a.referrerId} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                <div className="min-w-0 lg:w-48">
                  <p className="text-sm text-white truncate">{a.name}</p>
                  <p className="text-xs font-mono text-[#475569]">{a.code}</p>
                </div>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="전환가능" value={usd(a.pendingEligible)} tone="text-amber-400" />
                  <Stat label="보류" value={usd(a.pendingHeld)} tone="text-[#94A3B8]" />
                  <Stat label="지급완료" value={usd(a.paid)} tone="text-emerald-400" />
                  <Stat label="크레딧 잔액" value={usd(a.balanceCents)} tone="text-[#38BDF8]" />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:gap-3">
                  <ConvertButton referrerId={a.referrerId} />
                  <IssueDiscountForm userId={a.referrerId} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#475569] bg-[#111A2E] border border-[#1E293B] rounded-2xl px-5 py-6 text-center">아직 제휴 커미션이 없습니다.</p>
        )}
      </section>
    </div>
  )
}

/** 제휴자 행의 소형 지표 셀(라벨 + 금액) */
function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <p className="text-[#475569]">{label}</p>
      <p className={`font-mono font-semibold ${tone}`}>{value}</p>
    </div>
  )
}
