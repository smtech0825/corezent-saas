/**
 * @파일: api/auth/check-email/route.ts
 * @설명: 이메일 상태 확인 API — 회원가입 전 inactive(탈퇴) 계정 재가입 차단용
 *        POST { email } → { status: 'active' | 'inactive' | 'not_found' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ status: 'not_found' })
    }

    const adminClient = createAdminClient()

    // get_user_id_by_email RPC로 auth.users에서 ID 조회
    const { data: userId } = await adminClient.rpc('get_user_id_by_email', {
      p_email: email.trim().toLowerCase(),
    })

    if (!userId) return NextResponse.json({ status: 'not_found' })

    // profiles에서 status 확인
    const { data: profile } = await adminClient
      .from('profiles')
      .select('status')
      .eq('id', userId)
      .single()

    return NextResponse.json({ status: profile?.status ?? 'active' })
  } catch {
    return NextResponse.json({ status: 'not_found' })
  }
}
