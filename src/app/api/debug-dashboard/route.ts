/**
 * @파일: api/debug-dashboard/route.ts
 * @설명: 대시보드 데이터 디버그용 임시 API (배포 후 삭제 예정)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not logged in', userErr })
  }

  const [subRes, orderRes] = await Promise.all([
    supabase.from('subscriptions').select('id, status, user_id').eq('user_id', user.id),
    supabase.from('orders').select('id, status, amount, user_id').eq('user_id', user.id),
  ])

  return NextResponse.json({
    user_id: user.id,
    user_email: user.email,
    subscriptions: { data: subRes.data, error: subRes.error },
    orders: { data: orderRes.data, error: orderRes.error },
  })
}
