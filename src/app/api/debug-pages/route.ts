/**
 * @파일: api/debug-pages/route.ts
 * @설명: 대시보드 페이지 쿼리 디버그 — 어떤 쿼리가 실패하는지 확인용
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    results.auth = { user_id: user?.id, email: user?.email, error: authErr?.message }

    if (!user) {
      return NextResponse.json({ ...results, message: 'Not logged in' })
    }

    // 1) profile 조회 (layout에서 사용)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', user.id)
      .single()
    results.profile = { data: profile, error: profileErr?.message }

    // 2) support badge — user_last_read_at 포함
    const { data: badgeData, error: badgeErr } = await supabase
      .from('support_tickets')
      .select('user_last_read_at, updated_at')
      .eq('user_id', user.id)
      .eq('status', 'answered')
    results.badge_full = { data: badgeData, error: badgeErr?.message }

    // 3) support badge — 단순 카운트 (폴백)
    const { count: badgeCount, error: badgeCountErr } = await supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'answered')
    results.badge_fallback = { count: badgeCount, error: badgeCountErr?.message }

    // 4) licenses 쿼리
    const { data: licenses, error: licErr } = await supabase
      .from('licenses')
      .select('id, serial_key, status, expires_at, created_at, products(name, slug)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, 9)
    results.licenses = { count: licenses?.length, error: licErr?.message }

    // 5) subscriptions 쿼리
    const { data: subs, error: subErr } = await supabase
      .from('subscriptions')
      .select('id, status, billing_interval, current_period_end, cancel_at_period_end, customer_portal_url, product_price_id', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, 4)
    results.subscriptions = { count: subs?.length, error: subErr?.message }

    // 6) orders 쿼리
    const { data: orders, error: ordErr } = await supabase
      .from('orders')
      .select('id, amount, status, created_at, product_price_id', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, 4)
    results.orders = { count: orders?.length, error: ordErr?.message }

    // 7) support tickets 쿼리 (with user_last_read_at)
    const { data: tickets, error: tickErr } = await supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, updated_at, user_last_read_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, 4)
    results.support_tickets_full = { count: tickets?.length, error: tickErr?.message }

    // 8) support tickets 쿼리 (without user_last_read_at)
    const { data: tickets2, error: tickErr2 } = await supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, updated_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, 4)
    results.support_tickets_simple = { count: tickets2?.length, error: tickErr2?.message }

  } catch (err: unknown) {
    results.caught_exception = String(err)
  }

  return NextResponse.json(results)
}
