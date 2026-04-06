/**
 * @파일: supabase/client.ts
 * @설명: 브라우저(클라이언트 컴포넌트)용 Supabase 인스턴스
 *        'use client' 컴포넌트에서 import해서 사용
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
