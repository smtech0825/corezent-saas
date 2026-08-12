/**
 * @파일: dashboard/affiliate/page.tsx
 * @설명: 제휴(추천) 대시보드 — 읽기·표시 전용(DB 쓰기 없음).
 *        내 추천 코드/링크, 클릭·가입·전환 지표, 적립 현황(pending/approved/paid/reversed),
 *        스토어 크레딧 잔액(원장 합계)을 표시한다. 금액은 정수 cents → 표시 시에만 포맷.
 */

import { createClient } from '@/lib/supabase/server'
import { buildReferralUrl, getAffiliateConfig } from '@/lib/affiliate'
import { formatKRW } from '@/lib/money'
import DynamicIcon from '@/components/DynamicIcon'
import CopyButton from '@/components/common/CopyButton'
import PayoutAccountCard from './PayoutAccountCard'
import PageContainer from '@/components/common/PageContainer'
import StatCard from '@/components/common/StatCard'
import EmptyState from '@/components/common/EmptyState'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '제휴 프로그램',
  description: '내 추천 링크와 적립 현황, 스토어 크레딧 잔액을 확인하세요.',
}

/** 정수 cents(KRW 기준) → ₩ 표시 문자열 (표시 전용, 계산 아님) */
function formatCents(cents: number, _currency?: string): string {
  return formatKRW(cents)
}

export default async function AffiliatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 읽기 전용 — 일반 server 클라이언트(RLS)로 본인 데이터만 조회.
  //   commissions/attributions/ledger=본인 조회 정책, affiliate_clicks=030 '본인 코드 조회' 정책.
  const { data: profile } = await supabase
    .from('profiles')
    .select('affiliate_code, payout_bank, payout_account_number, payout_account_holder')
    .eq('id', user.id)
    .maybeSingle()
  const code: string | null = profile?.affiliate_code ?? null
  const payout = {
    bank: (profile?.payout_bank as string) ?? '',
    accountNumber: (profile?.payout_account_number as string) ?? '',
    accountHolder: (profile?.payout_account_holder as string) ?? '',
  }

  const [cfg, signupsRes, conversionsRes, commissionsRes, ledgerRes, clicksRes] = await Promise.all([
    getAffiliateConfig(),
    supabase.from('affiliate_attributions')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', user.id),
    // 전환 = 추천으로 가입해 첫 결제(converted_at 기록)한 피추천인 수.
    //   attribution은 피추천인당 1행이므로 행 수 = distinct 인원. 환불은 무시(역사적 전환 시각 보존).
    supabase.from('affiliate_attributions')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', user.id)
      .not('converted_at', 'is', null),
    supabase.from('affiliate_commissions')
      .select('commission_amount_cents, status, available_at')
      .eq('referrer_user_id', user.id),
    supabase.from('store_credit_ledger')
      .select('delta_cents')
      .eq('user_id', user.id),
    code
      ? supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true }).eq('referral_code', code)
      : Promise.resolve({ count: 0 }),
  ])

  const clicks = (clicksRes as { count: number | null }).count ?? 0
  const signups = signupsRes.count ?? 0
  const conversions = conversionsRes.count ?? 0

  // 적립 현황 집계 — pending은 보류(hold) 경과 여부로 '대기'/'지급 가능'을 구분.
  // (전환 게이트와 동일 기준: available_at 경과한 pending이 실제 전환 대상)
  const nowMs = Date.now()
  const buckets = {
    held:     { cents: 0, count: 0 }, // 보류 기간 중(아직 전환 불가)
    eligible: { cents: 0, count: 0 }, // 전환 가능(hold 경과 pending + approved)
    paid:     { cents: 0, count: 0 },
    reversed: { cents: 0, count: 0 },
  }
  for (const c of (commissionsRes.data ?? []) as Array<{ commission_amount_cents: number; status: string; available_at: string }>) {
    const cents = c.commission_amount_cents ?? 0
    let key: keyof typeof buckets | null = null
    if (c.status === 'pending') key = new Date(c.available_at).getTime() <= nowMs ? 'eligible' : 'held'
    else if (c.status === 'approved') key = 'eligible'
    else if (c.status === 'paid') key = 'paid'
    else if (c.status === 'reversed') key = 'reversed'
    if (key) {
      buckets[key].cents += cents
      buckets[key].count += 1
    }
  }

  // 스토어 크레딧 잔액 = 원장 delta 합
  const balanceCents = ((ledgerRes.data ?? []) as Array<{ delta_cents: number }>)
    .reduce((s, r) => s + (r.delta_cents ?? 0), 0)

  const currency = cfg?.currency ?? 'USD'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const referralUrl = code ? buildReferralUrl(siteUrl, code) : ''

  return (
    <PageContainer variant="dashboard">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink font-serif">제휴 프로그램</h1>
        <p className="text-ink-faint text-sm mt-1">
          내 추천 링크로 친구를 초대하면 결제 확정 후 스토어 크레딧을 적립받습니다.
        </p>
      </div>

      {/* 프로그램 비활성 안내 */}
      {cfg && !cfg.program_enabled && (
        <div className="mb-6 flex items-center gap-3 bg-caution-soft border border-caution/20 rounded-xl px-4 py-3">
          <DynamicIcon name="Info" size={16} className="text-caution shrink-0" />
          <p className="text-sm text-ink-soft">
            제휴 프로그램은 현재 준비 중입니다. 적립은 프로그램이 활성화된 이후 결제부터 집계됩니다.
          </p>
        </div>
      )}

      {/* 내 추천 링크 (벤토 wide) */}
      <section className="mb-6 bg-paper-raised border border-rule rounded-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <DynamicIcon name="Gift" size={18} className="text-mark" />
          <h2 className="text-sm font-semibold text-ink-faint uppercase tracking-wider">내 추천 링크</h2>
        </div>
        {code ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-ink-faint">추천 코드</span>
              <span className="font-mono text-mark text-sm font-semibold">{code}</span>
            </div>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0 bg-paper border border-rule rounded-lg px-4 py-3 flex items-center">
                <span className="font-mono text-sm text-ink truncate">{referralUrl}</span>
              </div>
              <CopyButton
                value={referralUrl}
                title="추천 링크 복사"
                iconSize={15}
                labels={{ idle: '복사', copied: '복사됨' }}
                className="shrink-0 inline-flex items-center gap-1.5 bg-mark text-white font-semibold px-4 rounded-lg text-sm hover:brightness-95 transition-colors"
              />
            </div>
          </>
        ) : (
          <EmptyState message="추천 코드가 아직 없습니다. 고객지원에 문의해 주세요." />
        )}
      </section>

      {/* 지표 벤토 그리드 — 공용 StatCard.
          아래 적립 현황(4열)과 열 수가 달라 세로선이 어긋나 보이던 것을,
          적립 현황과 같은 구획 제목을 붙여 별개 블록으로 읽히게 한다
          (3개 카드를 4열에 억지로 넣으면 빈 칸이 생겨 열 수 통일 대신 구분을 택함) */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-ink-faint uppercase tracking-wider mb-4">추천 성과</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          <StatCard icon={<DynamicIcon name="MousePointerClick" size={18} className="text-mark" />} label="클릭" value={clicks.toLocaleString()} />
          <StatCard icon={<DynamicIcon name="UserPlus" size={18} className="text-mark" />}          label="가입" value={signups.toLocaleString()} />
          <StatCard icon={<DynamicIcon name="ShoppingBag" size={18} className="text-mark" />}       label="전환" value={conversions.toLocaleString()} subline="추천으로 가입해 첫 결제한 인원 (환불 포함)" />
        </div>
      </section>

      {/* 스토어 크레딧 잔액 */}
      <section className="mb-6 bg-gradient-to-br from-paper-raised to-paper border border-mark/30 rounded-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <DynamicIcon name="Wallet" size={18} className="text-mark" />
          <h2 className="text-sm font-semibold text-ink-faint uppercase tracking-wider">스토어 크레딧 잔액</h2>
        </div>
        <p className="text-4xl font-bold text-ink">{formatCents(balanceCents, currency)}</p>
        {cfg && (
          <p className="text-xs text-ink-faint mt-2">
            최소 전환 금액 {formatCents(cfg.min_payout_credit, currency)} · 다음 결제 시 할인으로 사용됩니다.
          </p>
        )}
      </section>

      {/* 정산 계좌 */}
      <PayoutAccountCard initial={payout} />

      {/* 적립 현황 — 공용 StatCard (상태 색은 아이콘 배지에만) */}
      <section>
        <h2 className="text-sm font-semibold text-ink-faint uppercase tracking-wider mb-4">적립 현황</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          <StatCard
            icon={<DynamicIcon name="Clock" size={15} className={TONE.warning.text} />}
            iconBadgeClassName={`${TONE.warning.bg} border ${TONE.warning.border}`}
            label="대기" value={formatCents(buckets.held.cents, currency)}
            subline={`보류 기간 중 · ${buckets.held.count}건`}
          />
          <StatCard
            icon={<DynamicIcon name="CircleCheck" size={15} className={TONE.accent.text} />}
            iconBadgeClassName={`${TONE.accent.bg} border ${TONE.accent.border}`}
            label="지급 가능" value={formatCents(buckets.eligible.cents, currency)}
            subline={`전환 대기 · ${buckets.eligible.count}건`}
          />
          <StatCard
            icon={<DynamicIcon name="BadgeCheck" size={15} className={TONE.success.text} />}
            iconBadgeClassName={`${TONE.success.bg} border ${TONE.success.border}`}
            label="지급 완료" value={formatCents(buckets.paid.cents, currency)}
            subline={`크레딧 전환됨 · ${buckets.paid.count}건`}
          />
          <StatCard
            icon={<DynamicIcon name="CircleX" size={15} className={TONE.error.text} />}
            iconBadgeClassName={`${TONE.error.bg} border ${TONE.error.border}`}
            label="반려" value={formatCents(buckets.reversed.cents, currency)}
            subline={`환불·취소 · ${buckets.reversed.count}건`}
          />
        </div>
      </section>
    </PageContainer>
  )
}

// ─── 서브 컴포넌트 ───────────────────────────────────────────
// 지표·적립 카드는 공용 StatCard(components/common/StatCard.tsx)를 쓴다.

/** 적립 상태별 색조 — 아이콘 배지에만 쓴다(카드 모양은 공용과 동일하게 유지) */
const TONE: Record<string, { text: string; bg: string; border: string }> = {
  warning: { text: 'text-caution', bg: 'bg-caution-soft', border: 'border-caution/20' },
  accent:  { text: 'text-mark',    bg: 'bg-mark/10',      border: 'border-mark/30' },
  success: { text: 'text-ok',      bg: 'bg-ok-soft',      border: 'border-ok/20' },
  error:   { text: 'text-danger',  bg: 'bg-danger-soft',  border: 'border-danger/20' },
}
