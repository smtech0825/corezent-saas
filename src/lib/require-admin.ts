/**
 * @파일: lib/require-admin.ts
 * @설명: 관리자 API 라우트 공통 인증·권한 가드
 *        쿠키 세션으로 로그인 사용자를 확인하고 profiles.role === 'admin' 인지 검증한다.
 *        /api/admin/* 라우트는 middleware 보호 대상이 아니므로(경로가 /api로 시작) 각 라우트가
 *        직접 이 가드를 진입부에서 호출해야 한다.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** requireAdmin 결과 — 통과 시 userId, 실패 시 그대로 반환할 에러 응답 */
export type AdminGate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

/**
 * @함수명: requireAdmin
 * @설명: 관리자 권한을 검증한다. 비로그인은 401, 로그인했으나 admin이 아니면 403을 반환한다.
 *        role 조회는 service role 클라이언트로 수행해 RLS 재귀 문제를 피한다(admin/layout.tsx와 동일 패턴).
 * @반환값: { ok: true, userId } 또는 { ok: false, response } — 라우트는 !ok 시 response를 즉시 반환
 */
export async function requireAdmin(): Promise<AdminGate> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  // service role key로 RLS 우회하여 role 조회
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true, userId: user.id }
}
