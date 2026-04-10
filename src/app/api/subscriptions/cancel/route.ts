/**
 * @파일: api/subscriptions/cancel/route.ts
 * @설명: 구독 취소 API — 소유권 검증 후 Lemon Squeezy 취소 + DB 상태/사유 업데이트
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { subscriptionId, reason } = (await request.json()) as {
      subscriptionId: string
      reason: string
    }

    if (!subscriptionId || !reason) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // 1. 현재 로그인 사용자 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 구독 소유권 검증 (서버사이드 — RLS 우회하지 않고 직접 확인)
    const adminClient = createAdminClient()
    const { data: subscription, error: fetchErr } = await adminClient
      .from('subscriptions')
      .select('id, user_id, status, lemon_squeezy_subscription_id')
      .eq('id', subscriptionId)
      .single()

    if (fetchErr || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // 구독이 현재 로그인 사용자 소유인지 검증
    if (subscription.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (subscription.status !== 'active') {
      return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 })
    }

    const lsSubId = subscription.lemon_squeezy_subscription_id
    if (!lsSubId) {
      return NextResponse.json({ error: 'Lemon Squeezy subscription ID missing' }, { status: 500 })
    }

    // 3. Lemon Squeezy API로 구독 취소 (현재 결제 주기 종료 시점에 취소)
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY
    if (!apiKey) {
      throw new Error('LEMON_SQUEEZY_API_KEY is not configured')
    }

    const lsRes = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${lsSubId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
    })

    // LS는 취소 성공 시 200 또는 200 OK 응답
    if (!lsRes.ok) {
      const body = await lsRes.text()
      console.error('[subscriptions/cancel] Lemon Squeezy API error:', lsRes.status, body)
      throw new Error(`Lemon Squeezy API error: ${lsRes.status}`)
    }

    // 4. DB 상태 업데이트 — cancelled + 취소 사유 저장
    const { error: updateErr } = await adminClient
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancel_at_period_end: true,
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)

    if (updateErr) {
      console.error('[subscriptions/cancel] DB update error:', updateErr)
      throw new Error(`DB update failed: ${updateErr.message}`)
    }

    console.log(`[subscriptions/cancel] 구독 취소 완료: ${subscriptionId} (reason: ${reason})`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[subscriptions/cancel]', err)
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
