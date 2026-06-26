/**
 * @파일: lib/affiliate-commission.ts
 * @설명: 추천 커미션 적립·반전(클로백) — 웹훅 전용, 서버 전용.
 *        금액은 전부 결정적 코드로 통화 최소단위(정수 cents) 기준 계산한다.
 *        ⚠️ 적립/반전 경로는 스키마-누락 관용을 적용하지 않는다.
 *           (에러를 삼키면 커미션 유실 → DB 에러는 throw로 전파, 호출측 웹훅이 로깅)
 *           유일한 예외는 멱등성 UNIQUE 충돌(23505) — 이미 적립된 것이므로 정상 skip.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeRefCode, type AffiliateConfig } from '@/lib/affiliate'

type Admin = ReturnType<typeof createAdminClient>

/** Supabase 에러를 명시적 Error로 승격(코드 포함) */
function fail(context: string, error: { code?: string | null; message?: string } | null | undefined): never {
  throw new Error(`[affiliate-commission] ${context}: ${error?.code ?? ''} ${error?.message ?? error ?? ''}`.trim())
}

/**
 * @함수명: loadConfigStrict
 * @설명: affiliate_program_config를 조회합니다(관용 없음 — 누락/에러 시 throw).
 */
async function loadConfigStrict(admin: Admin): Promise<AffiliateConfig> {
  const { data, error } = await admin
    .from('affiliate_program_config')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  if (error) fail('config 조회 실패', error)
  if (!data) throw new Error('[affiliate-commission] affiliate_program_config 미시드')
  return data as AffiliateConfig
}

/**
 * @함수명: computeCommissionCents
 * @설명: 설정 기준으로 커미션 금액(정수 cents)을 결정적으로 계산합니다.
 *        percent: floor(gross × value / 100) — 과지급 방지 위해 내림.
 *        flat:    value(cents), 단 주문 금액(gross) 초과 금지.
 * @매개변수: grossCents - 기준 금액(gross, cents), cfg - 프로그램 설정
 * @반환값: 커미션 금액(정수 cents, 0 이상)
 */
export function computeCommissionCents(grossCents: number, cfg: AffiliateConfig): number {
  const gross = Math.max(0, Math.trunc(grossCents))
  if (cfg.commission_type === 'flat') {
    const flat = Math.max(0, Math.trunc(cfg.commission_value))
    return Math.min(flat, gross)
  }
  // percent
  return Math.floor((gross * cfg.commission_value) / 100)
}

export interface AccrueParams {
  sourceType: 'order' | 'subscription_renewal'
  sourceId: string                       // 멱등성 키 (LS order id 또는 invoice id)
  buyerUserId: string                    // 구매자(피추천인) user id
  affiliateRefRaw: string | null | undefined // custom_data.affiliate_ref
  grossCents: number                     // gross 기준 금액(cents) — Wave 0 결정
  currency: string
  subscriptionId?: string | null         // 갱신 캡 카운트용(LS 구독 id)
}

/**
 * @함수명: accrueCommission
 * @설명: 결제 확정 시 추천 커미션을 pending으로 적립합니다(결정적·멱등).
 *        추천인 해석(custom_data.affiliate_ref → 없으면 구매자 referred_by),
 *        자기추천 재확인, program_enabled·갱신 캡 검사 후 1건 적립.
 *        DB 에러는 throw(웹훅이 로깅·전파). 멱등 충돌(23505)만 정상 skip.
 */
export async function accrueCommission(p: AccrueParams): Promise<void> {
  const admin = createAdminClient()
  const cfg = await loadConfigStrict(admin)
  if (!cfg.program_enabled) return // 프로그램 OFF — 적립 안 함(에러 아님)

  // 추천인 코드: custom_data.affiliate_ref 우선, 없으면 구매자 referred_by
  let code = normalizeRefCode(p.affiliateRefRaw)
  if (!code) {
    const { data: buyer, error } = await admin
      .from('profiles')
      .select('referred_by')
      .eq('id', p.buyerUserId)
      .maybeSingle()
    if (error) fail('구매자 referred_by 조회 실패', error)
    code = normalizeRefCode(buyer?.referred_by)
  }
  if (!code) return // 추천인 없음 — 적립 대상 아님

  // 추천인 조회 (affiliate_code → user id)
  const { data: referrer, error: refErr } = await admin
    .from('profiles')
    .select('id')
    .eq('affiliate_code', code)
    .maybeSingle()
  if (refErr) fail('추천인 조회 실패', refErr)
  if (!referrer) return // 유효하지 않은 코드

  // 자기추천 재확인 (⑦ — 웹훅에서도 차단)
  if (cfg.self_referral_blocked && referrer.id === p.buyerUserId) return

  // 갱신 캡: 반복 적립 비활성이면 skip, 활성이면 구독별 누적 < cap
  if (p.sourceType === 'subscription_renewal') {
    if (!cfg.is_recurring) return
    if (p.subscriptionId) {
      const { count, error: cntErr } = await admin
        .from('affiliate_commissions')
        .select('id', { count: 'exact', head: true })
        .eq('subscription_id', p.subscriptionId)
        .eq('source_type', 'subscription_renewal')
      if (cntErr) fail('갱신 적립 카운트 실패', cntErr)
      if ((count ?? 0) >= cfg.recurring_months_cap) return // 캡 도달
    }
  }

  // 귀속 행 연결(있으면)
  const { data: attribution } = await admin
    .from('affiliate_attributions')
    .select('id')
    .eq('referred_user_id', p.buyerUserId)
    .maybeSingle()

  // 금액 계산(결정적, 정수 cents)
  const grossCents = Math.max(0, Math.trunc(p.grossCents))
  const commissionCents = computeCommissionCents(grossCents, cfg)
  if (commissionCents <= 0) return

  const availableAt = new Date(Date.now() + cfg.hold_days * 86400000).toISOString()

  const { error: insErr } = await admin.from('affiliate_commissions').insert({
    referrer_user_id: referrer.id,
    attribution_id: attribution?.id ?? null,
    source_type: p.sourceType,
    source_id: p.sourceId,
    subscription_id: p.subscriptionId ?? null,
    gross_amount_cents: grossCents,
    commission_amount_cents: commissionCents,
    currency: p.currency || cfg.currency,
    status: 'pending',
    available_at: availableAt,
  })
  if (insErr) {
    if (insErr.code === '23505') return // 멱등성: 같은 source 이미 적립됨
    fail('커미션 적립 실패', insErr)
  }
}

/**
 * @함수명: reverseCommissionsBySource
 * @설명: 환불/실패 시 해당 source의 커미션을 reversed 처리합니다.
 *        실제 반전·클로백(음수잔액 금지·관리자 플래그)은 원자적 RPC
 *        reverse_affiliate_commissions(030)가 단일 트랜잭션·행 잠금으로 수행한다.
 *        (앱 측 read-then-write 없음. 멱등: 이미 reversed면 RPC가 skip)
 */
export async function reverseCommissionsBySource(
  sourceType: 'order' | 'subscription_renewal',
  sourceId: string,
): Promise<void> {
  if (!sourceId) return
  const admin = createAdminClient()
  const { error } = await admin.rpc('reverse_affiliate_commissions', {
    p_source_type: sourceType,
    p_source_id: sourceId,
  })
  if (error) fail('커미션 반전 RPC 실패', error)
}

/**
 * @함수명: redeemStoreCredit
 * @설명: 스토어 크레딧을 차감합니다(체크아웃 할인 발급/사용). 원자적 RPC
 *        redeem_store_credit(030)이 잔액 검증·음수잔액 금지·원장 기록을 한 트랜잭션으로.
 * @매개변수: userId - 대상 사용자, amountCents - 차감액(정수 cents), ref - 참조(할인 코드 등)
 * @반환값: { ok, balance?, reason? }
 */
export async function redeemStoreCredit(
  userId: string,
  amountCents: number,
  ref: string,
): Promise<{ ok: boolean; balance?: number; reason?: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('redeem_store_credit', {
    p_user: userId,
    p_amount: amountCents,
    p_ref: ref,
  })
  if (error) fail('크레딧 차감 RPC 실패', error)
  return (data ?? { ok: false, reason: 'no_result' }) as { ok: boolean; balance?: number; reason?: string }
}

/**
 * @함수명: convertReferrerCommissions
 * @설명: 추천인의 전환 가능 커미션(pending+available_at경과+합계≥min)을 크레딧으로 전환합니다.
 *        게이트·payouts·paid·ledger 적립을 원자적 RPC convert_referrer_commissions(030)가 수행.
 * @매개변수: referrerUserId - 추천인 user id
 * @반환값: RPC 결과(jsonb)
 */
export async function convertReferrerCommissions(
  referrerUserId: string,
): Promise<{ ok: boolean; reason?: string; amount?: number; count?: number; total?: number; min?: number }> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('convert_referrer_commissions', {
    p_referrer: referrerUserId,
  })
  if (error) fail('커미션 전환 RPC 실패', error)
  return (data ?? { ok: false, reason: 'no_result' }) as { ok: boolean; reason?: string; amount?: number; count?: number; total?: number; min?: number }
}
