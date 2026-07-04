/**
 * @파일: api/subscriptions/cancel/route.ts
 * @설명: 구독 취소 API — 소유권 검증 후 Lemon Squeezy 취소 + DB 상태/사유 업데이트.
 *        실패 사유별로 machine-readable `code`를 함께 반환해 클라이언트가 사용자 메시지를 구분한다.
 *        LS에 실체가 없는 구독(LS id NULL·LS 404)은 DB에서만 취소 예약 처리해 사용자 의도를 존중한다.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * @함수명: markCancelScheduled
 * @설명: 구독을 DB에서 '취소 예약' 상태로 표시한다(cancel_at_period_end=true + 사유 기록).
 *        LS 취소 성공 후, 또는 LS에 실체가 없는 구독을 로컬에서만 취소할 때 공용으로 사용.
 * @매개변수: adminClient - service role Supabase 클라이언트(RLS 우회)
 * @매개변수: subscriptionId - 내부 subscriptions.id
 * @매개변수: reason - 사용자가 선택한 취소 사유
 * @반환값: 업데이트 에러 메시지(성공 시 null)
 */
async function markCancelScheduled(
  adminClient: SupabaseClient,
  subscriptionId: string,
  reason: string,
): Promise<string | null> {
  const { error } = await adminClient
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      cancellation_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
  return error ? error.message : null
}

export async function POST(request: Request) {
  try {
    const { subscriptionId, reason } = (await request.json()) as {
      subscriptionId: string
      reason: string
    }

    if (!subscriptionId || !reason) {
      return NextResponse.json({ error: 'Invalid payload', code: 'INVALID_PAYLOAD' }, { status: 400 })
    }

    // 1. 현재 로그인 사용자 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    // 2. 구독 소유권 검증 (서버사이드 — RLS 우회하지 않고 직접 확인)
    const adminClient = createAdminClient()
    const { data: subscription, error: fetchErr } = await adminClient
      .from('subscriptions')
      .select('id, user_id, status, cancel_at_period_end, lemon_squeezy_subscription_id')
      .eq('id', subscriptionId)
      .single()

    if (fetchErr || !subscription) {
      return NextResponse.json({ error: 'Subscription not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    // 구독이 현재 로그인 사용자 소유인지 검증
    if (subscription.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    if (subscription.status !== 'active') {
      return NextResponse.json({ error: 'Subscription is not active', code: 'NOT_ACTIVE' }, { status: 400 })
    }

    // 이미 취소 예약된 구독은 중복 취소 방지
    if (subscription.cancel_at_period_end === true) {
      return NextResponse.json({ error: 'Subscription is already scheduled for cancellation', code: 'ALREADY_CANCELLED' }, { status: 400 })
    }

    const lsSubId = subscription.lemon_squeezy_subscription_id

    // 3-a. LS 구독 ID가 없는 경우(테스트/수동 삽입 데이터 등) — LS에 취소할 실체가 없으므로
    //      DB에서만 취소 예약 처리하고 사용자에게는 정상 취소로 응답한다.
    if (!lsSubId) {
      const updateMsg = await markCancelScheduled(adminClient, subscriptionId, reason)
      if (updateMsg) {
        console.error('[subscriptions/cancel] DB update error (local-only):', updateMsg)
        return NextResponse.json({ error: `DB update failed: ${updateMsg}`, code: 'DB_ERROR' }, { status: 500 })
      }
      console.log(`[subscriptions/cancel] LS id 없음 → DB 로컬 취소 처리: ${subscriptionId} (reason: ${reason})`)
      return NextResponse.json({ ok: true, code: 'CANCELLED_LOCAL_ONLY' })
    }

    // 3-b. Lemon Squeezy API로 구독 취소 (현재 결제 주기 종료 시점에 취소)
    const apiKey = process.env.LEMONSQUEEZY_API_KEY
    if (!apiKey) {
      throw new Error('LEMONSQUEEZY_API_KEY is not configured')
    }

    const lsRes = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${lsSubId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
    })

    // LS는 취소 성공 시 200 OK 응답
    if (!lsRes.ok) {
      const body = await lsRes.text()
      console.error('[subscriptions/cancel] Lemon Squeezy API error:', lsRes.status, body)

      // 404 = LS에 해당 구독이 없음(이미 취소·모드 불일치·삭제됨). 로컬에서만 취소 예약 처리.
      if (lsRes.status === 404) {
        const updateMsg = await markCancelScheduled(adminClient, subscriptionId, reason)
        if (updateMsg) {
          console.error('[subscriptions/cancel] DB update error (ls-404):', updateMsg)
          return NextResponse.json({ error: `DB update failed: ${updateMsg}`, code: 'DB_ERROR' }, { status: 500 })
        }
        console.log(`[subscriptions/cancel] LS 404 → DB 로컬 취소 처리: ${subscriptionId}`)
        return NextResponse.json({ ok: true, code: 'CANCELLED_LOCAL_ONLY' })
      }

      // 그 외 LS 오류(403·5xx 등)는 결제사 측 문제 — 취소하지 않고 사용자에게 재시도 안내
      return NextResponse.json({ error: `Lemon Squeezy API error: ${lsRes.status}`, code: 'LS_API_ERROR' }, { status: 502 })
    }

    // 4. DB 상태 업데이트 — '취소 예약'으로 즉시 반영.
    //    status는 'active' 유지(결제 기간 종료까지 접근 유지) + cancel_at_period_end=true로 취소 예약 표시.
    //    최종 'cancelled'/'expired' 전환은 LS 웹훅(subscription_cancelled/expired) 도착 시 덮어씀.
    const updateMsg = await markCancelScheduled(adminClient, subscriptionId, reason)
    if (updateMsg) {
      console.error('[subscriptions/cancel] DB update error:', updateMsg)
      return NextResponse.json({ error: `DB update failed: ${updateMsg}`, code: 'DB_ERROR' }, { status: 500 })
    }

    console.log(`[subscriptions/cancel] 구독 취소 완료: ${subscriptionId} (reason: ${reason})`)
    return NextResponse.json({ ok: true, code: 'CANCELLED' })
  } catch (err) {
    console.error('[subscriptions/cancel]', err)
    return NextResponse.json({ error: 'Failed to cancel subscription', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
