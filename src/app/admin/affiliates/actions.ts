'use server'

/**
 * @파일: admin/affiliates/actions.ts
 * @설명: 제휴 관리 서버 액션 — 모두 관리자 전용(assertAdmin).
 *        커미션 전환·config 편집·크레딧 할인 발급·검토 플래그 해제.
 *        규칙값은 affiliate_program_config(DB)에서만 읽고, 크레딧 변경은 030 원자 RPC 경유.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { convertReferrerCommissions, redeemStoreCredit } from '@/lib/affiliate-commission'
import { createLsDiscount, generateSerialKey } from '@/lib/lemonsqueezy'
import { formatKRW } from '@/lib/money'
import type { AffiliateConfigInput } from './types'

/** 현재 요청 사용자가 관리자인지 검증 — 아니면 throw(관리자 전용 보장) */
async function assertAdmin(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증이 필요합니다.')
  const admin = createAdminClient()
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') throw new Error('관리자 권한이 필요합니다.')
}

/** 정수 정규화(최소값 clamp) */
function clampInt(v: unknown, min: number): number {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? Math.max(min, n) : min
}

/** 추천인 커미션을 크레딧으로 전환(게이트·원자성은 RPC가 강제) */
export async function convertCommissionsAction(
  referrerId: string,
): Promise<{ ok: boolean; message: string }> {
  await assertAdmin()
  if (!referrerId) return { ok: false, message: '대상이 없습니다.' }

  const r = await convertReferrerCommissions(referrerId)
  revalidatePath('/admin/affiliates')

  if (r.ok) {
    return { ok: true, message: `전환 완료: ${r.count ?? 0}건 · ${formatKRW(r.amount ?? 0)} 크레딧 적립` }
  }
  if (r.reason === 'below_min') {
    return { ok: false, message: `최소 전환 금액 미달 (전환가능 합계 ${formatKRW(r.total ?? 0)} < 최소 ${formatKRW(r.min ?? 0)})` }
  }
  return { ok: false, message: `전환 불가: ${r.reason ?? '알 수 없음'}` }
}

/** affiliate_program_config 편집 — 규칙값 단일 출처 갱신 */
export async function updateAffiliateConfigAction(
  values: AffiliateConfigInput,
): Promise<{ ok: boolean; message: string }> {
  await assertAdmin()
  const admin = createAdminClient()

  const payload = {
    program_enabled:       !!values.program_enabled,
    commission_type:       values.commission_type === 'flat' ? 'flat' : 'percent',
    commission_value:      clampInt(values.commission_value, 0),
    is_recurring:          !!values.is_recurring,
    recurring_months_cap:  clampInt(values.recurring_months_cap, 0),
    cookie_days:           clampInt(values.cookie_days, 0),
    hold_days:             clampInt(values.hold_days, 0),
    min_payout_credit:     clampInt(values.min_payout_credit, 0),
    currency:              (values.currency || 'KRW').toUpperCase().slice(0, 3),
    self_referral_blocked: !!values.self_referral_blocked,
    updated_at:            new Date().toISOString(),
  }

  const { error } = await admin.from('affiliate_program_config').update(payload).eq('id', true)
  if (error) return { ok: false, message: error.message }
  revalidatePath('/admin/affiliates')
  return { ok: true, message: '설정이 저장되었습니다.' }
}

/**
 * 크레딧 → 1회용 LS 고정금액 할인 발급.
 * 1) 원자적 차감(잔액 부족 시 차단) → 2) LS 할인 자동 생성.
 *    LS 자동 생성 실패해도 차감은 유지되며, 관리자가 동일 코드로 수동 발급하도록 안내(폴백).
 */
export async function issueCreditDiscountAction(
  userId: string,
  amountCents: number,
): Promise<{ ok: boolean; message: string; code?: string }> {
  await assertAdmin()
  if (!userId || !Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, message: '유효하지 않은 입력입니다.' }
  }

  const code = `CZCREDIT-${generateSerialKey().replace(/-/g, '').slice(0, 10)}`

  // 1) 원자적 차감(음수잔액 금지)
  const redeem = await redeemStoreCredit(userId, amountCents, code)
  if (!redeem.ok) {
    if (redeem.reason === 'insufficient') {
      return { ok: false, message: `잔액 부족 (현재 ${formatKRW(redeem.balance ?? 0)})` }
    }
    return { ok: false, message: `차감 실패: ${redeem.reason ?? '알 수 없음'}` }
  }

  // 2) LS 할인 자동 생성(차감은 이미 기록됨 — 실패 시 수동 폴백)
  const disc = await createLsDiscount({ code, name: `Store credit ${code}`, amountCents })
  revalidatePath('/admin/affiliates')

  if (disc.ok) {
    return { ok: true, code, message: `할인 발급 완료. 코드 ${code} 를 고객에게 전달하세요.` }
  }
  return {
    ok: true,
    code,
    message: `크레딧 ${formatKRW(amountCents)} 차감됨(코드 ${code}). LS 자동 발급 실패 — LS 대시보드에서 고정금액 ${formatKRW(amountCents)} · 1회용 코드 ${code} 를 수동 발급하세요. (${disc.error})`,
  }
}

/** 환불 클로백 검토 플래그 해제 */
export async function resolveReviewAction(commissionId: string): Promise<{ ok: boolean }> {
  await assertAdmin()
  if (!commissionId) return { ok: false }
  const admin = createAdminClient()
  const { error } = await admin
    .from('affiliate_commissions')
    .update({ needs_admin_review: false })
    .eq('id', commissionId)
  if (error) return { ok: false }
  revalidatePath('/admin/affiliates')
  return { ok: true }
}
