/**
 * @파일: supabase/admin.ts
 * @설명: 관리자 전용 Supabase 클라이언트 — Service Role Key 사용, RLS 우회
 *        서버 측에서만 사용 (절대 클라이언트에 노출 금지)
 */

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
