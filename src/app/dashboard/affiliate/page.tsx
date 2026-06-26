/**
 * @파일: dashboard/affiliate/page.tsx
 * @설명: 제휴(추천) 대시보드 — 읽기·표시 전용(DB 쓰기 없음).
 *        내 추천 코드/링크, 클릭·가입·전환 지표, 적립 현황(pending/approved/paid/reversed),
 *        스토어 크레딧 잔액(원장 합계)을 표시한다. 금액은 정수 cents → 표시 시에만 포맷.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildReferralUrl, getAffiliateConfig } from '@/lib/affiliate'
import DynamicIcon from '@/components/DynamicIcon'
import ReferralCopyButton from '../_components/ReferralCopyButton'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '제휴 프로그램 — CoreZent',
  description: '내 추천 링크와 적립 현황, 스토어 크레딧 잔액을 확인하세요.',
}

/** 정수 cents → 통화 표시 문자열 (표시 전용, 계산 아님) */
function formatCents(cents: number, currency: string): string {
  const v = (cents / 100).toFixed(2)
  return currency === 'USD' ? `$${v}` : `${v} ${currency}`
}

const COMMISSION_STATUSES = ['pending', 'approved', 'paid', 'reversed'] as const
type CommissionStatus = (typeof COMMISSION_STATUSES)[number]

export default async function AffiliatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 읽기 전용 — admin 클라이언트로 본인(user.id/affiliate_code) 데이터만 조회
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('affiliate_code')
    .eq('id', user.id)
    .maybeSingle()
  const code: string | null = profile?.affiliate_code ?? null

  const [cfg, signupsRes, conversionsRes, commissionsRes, ledgerRes, clicksRes] = await Promise.all([
    getAffiliateConfig(),
    admin.from('affiliate_attributions')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', user.id),
    admin.from('affiliate_commissions')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', user.id)
      .eq('source_type', 'order')
      .neq('status', 'reversed'),
    admin.from('affiliate_commissions')
      .select('commission_amount_cents, status')
      .eq('referrer_user_id', user.id),
    admin.from('store_credit_ledger')
      .select('delta_cents')
      .eq('user_id', user.id),
    code
      ? admin.from('affiliate_clicks').select('id', { count: 'exact', head: true }).eq('referral_code', code)
      : Promise.resolve({ count: 0 }),
  ])

  const clicks = (clicksRes as { count: number | null }).count ?? 0
  const signups = signupsRes.count ?? 0
  const conversions = conversionsRes.count ?? 0

  // 적립 현황 집계(상태별 금액 합·건수)
  const buckets: Record<CommissionStatus, { cents: number; count: number }> = {
    pending:  { cents: 0, count: 0 },
    approved: { cents: 0, count: 0 },
    paid:     { cents: 0, count: 0 },
    reversed: { cents: 0, count: 0 },
  }
  for (const c of (commissionsRes.data ?? []) as Array<{ commission_amount_cents: number; status: string }>) {
    const b = buckets[c.status as CommissionStatus]
    if (b) {
      b.cents += c.commission_amount_cents ?? 0
      b.count += 1
    }
  }

  // 스토어 크레딧 잔액 = 원장 delta 합
  const balanceCents = ((ledgerRes.data ?? []) as Array<{ delta_cents: number }>)
    .reduce((s, r) => s + (r.delta_cents ?? 0), 0)

  const currency = cfg?.currency ?? 'USD'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const referralUrl = code ? buildReferralUrl(siteUrl, code) : ''

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">제휴 프로그램</h1>
        <p className="text-text-muted text-sm mt-1">
          내 추천 링크로 친구를 초대하면 결제 확정 후 스토어 크레딧을 적립받습니다.
        </p>
      </div>

      {/* 프로그램 비활성 안내 */}
      {cfg && !cfg.program_enabled && (
        <div className="mb-6 flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
          <DynamicIcon name="Info" size={16} className="text-warning shrink-0" />
          <p className="text-sm text-text-muted">
            제휴 프로그램은 현재 준비 중입니다. 적립은 프로그램이 활성화된 이후 결제부터 집계됩니다.
          </p>
        </div>
      )}

      {/* 내 추천 링크 (벤토 wide) */}
      <section className="mb-6 bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <DynamicIcon name="Gift" size={18} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">내 추천 링크</h2>
        </div>
        {code ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-text-muted">추천 코드</span>
              <span className="font-mono text-accent text-sm font-semibold">{code}</span>
            </div>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-4 py-3 flex items-center">
                <span className="font-mono text-sm text-text truncate">{referralUrl}</span>
              </div>
              <ReferralCopyButton value={referralUrl} />
            </div>
          </>
        ) : (
          <p className="text-sm text-text-muted">추천 코드가 아직 없습니다. 고객지원에 문의해 주세요.</p>
        )}
      </section>

      {/* 지표 벤토 그리드 */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard icon="MousePointerClick" label="클릭" value={clicks.toLocaleString()} />
        <MetricCard icon="UserPlus"          label="가입" value={signups.toLocaleString()} />
        <MetricCard icon="ShoppingBag"       label="전환 (첫 구매)" value={conversions.toLocaleString()} />
      </section>

      {/* 스토어 크레딧 잔액 */}
      <section className="mb-6 bg-gradient-to-br from-surface to-bg border border-accent/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <DynamicIcon name="Wallet" size={18} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">스토어 크레딧 잔액</h2>
        </div>
        <p className="text-4xl font-bold text-white">{formatCents(balanceCents, currency)}</p>
        {cfg && (
          <p className="text-xs text-text-muted mt-2">
            최소 전환 금액 {formatCents(cfg.min_payout_credit, currency)} · 다음 결제 시 할인으로 사용됩니다.
          </p>
        )}
      </section>

      {/* 적립 현황 */}
      <section>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">적립 현황</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard tone="warning" icon="Clock"       label="대기"      sub="보류 기간 중"   cents={buckets.pending.cents}  count={buckets.pending.count}  currency={currency} />
          <StatusCard tone="accent"  icon="CircleCheck" label="지급 가능"  sub="전환 대기"     cents={buckets.approved.cents} count={buckets.approved.count} currency={currency} />
          <StatusCard tone="success" icon="BadgeCheck"  label="지급 완료"  sub="크레딧 전환됨"  cents={buckets.paid.cents}     count={buckets.paid.count}     currency={currency} />
          <StatusCard tone="error"   icon="CircleX"     label="반려"      sub="환불·취소"     cents={buckets.reversed.cents} count={buckets.reversed.count} currency={currency} />
        </div>
      </section>
    </div>
  )
}

// ─── 서브 컴포넌트 ───────────────────────────────────────────

/** 지표 카드 (클릭·가입·전환) */
function MetricCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
        <DynamicIcon name={icon} size={18} className="text-accent" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
    </div>
  )
}

const TONE: Record<string, { text: string; bg: string; border: string }> = {
  warning: { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
  accent:  { text: 'text-accent',  bg: 'bg-accent/10',  border: 'border-accent/20' },
  success: { text: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  error:   { text: 'text-error',   bg: 'bg-error/10',   border: 'border-error/20' },
}

/** 상태별 적립 카드 (금액 합·건수) */
function StatusCard({
  tone, icon, label, sub, cents, count, currency,
}: {
  tone: keyof typeof TONE
  icon: string
  label: string
  sub: string
  cents: number
  count: number
  currency: string
}) {
  const t = TONE[tone]
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className={`w-8 h-8 rounded-lg ${t.bg} border ${t.border} flex items-center justify-center mb-3`}>
        <DynamicIcon name={icon} size={15} className={t.text} />
      </div>
      <p className="text-lg font-bold text-white">{formatCents(cents, currency)}</p>
      <p className={`text-xs font-medium mt-1 ${t.text}`}>{label}</p>
      <p className="text-xs text-text-muted mt-0.5">{sub} · {count}건</p>
    </div>
  )
}
