'use server'

/**
 * @파일: dashboard/settings/withdraw-actions.ts
 * @설명: 회원 셀프 탈퇴 서버 액션 — 소프트 삭제(status='inactive' + Supabase Auth ban).
 *        관리자 withdrawUser(admin/users/actions.ts)와 동일 방식으로 데이터/FK를 보존한다.
 *        활성(계속 청구되는) 구독이 있으면 탈퇴를 차단하고 구독 취소를 먼저 요구한다.
 *        admin 클라이언트(SERVICE_ROLE)는 서버 전용 액션인 이 파일에서만 사용한다.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** 탈퇴 결과 — ok=true면 성공, 아니면 reason으로 사유 구분 */
export type WithdrawResult =
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'active_subscription' | 'error' }

/**
 * @함수명: withdrawSelf
 * @설명: 현재 로그인한 회원 본인을 탈퇴(소프트 삭제) 처리합니다.
 *        - 계속 청구되는 활성 구독이 있으면 차단하고 'active_subscription' 반환.
 *        - profiles.status='inactive' + Auth ban(로그인 차단)으로 처리, 이력은 보존.
 * @반환값: 성공 { ok: true } / 실패 { ok: false, reason }
 */
export async function withdrawSelf(): Promise<WithdrawResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  const admin = createAdminClient()

  // 1) 재청구 가능 구독(active + paused=재개 시 재청구)이 있고 기간 말 취소 예약이 아니면 탈퇴 차단.
  //    탈퇴(로그인 차단) 후 구독이 재청구되는 상황을 막기 위해 fail-closed로 paused도 포함한다.
  const { data: activeSubs, error: subErr } = await admin
    .from('subscriptions')
    .select('id, cancel_at_period_end')
    .eq('user_id', user.id)
    .in('status', ['active', 'paused'])

  if (subErr) return { ok: false, reason: 'error' }
  if ((activeSubs ?? []).some((s) => s.cancel_at_period_end !== true)) {
    return { ok: false, reason: 'active_subscription' }
  }

  // 2) 소프트 삭제 — profiles.status='inactive' (재가입은 check-email에서 차단)
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ status: 'inactive' })
    .eq('id', user.id)
  if (profileErr) return { ok: false, reason: 'error' }

  // 3) Supabase Auth 로그인 차단 (100년 ban) — 관리자 withdrawUser와 동일
  const { error: banErr } = await admin.auth.admin.updateUserById(user.id, {
    ban_duration: '876000h',
  })
  if (banErr) return { ok: false, reason: 'error' }

  // 4) 현재 세션 쿠키 정리
  await supabase.auth.signOut()

  return { ok: true }
}
