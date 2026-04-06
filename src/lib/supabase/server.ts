/**
 * @파일: supabase/server.ts
 * @설명: 서버(Server Component, Route Handler, Server Action)용 Supabase 인스턴스
 *        Next.js cookies()를 통해 세션 쿠키를 읽고 씀
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component에서 호출 시 무시 (미들웨어에서 처리됨)
          }
        },
      },
    },
  )
}
