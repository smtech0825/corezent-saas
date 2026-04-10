/**
 * @파일: api/admin/settings/route.ts
 * @설명: 사이트 설정 저장 API — front_settings 테이블 upsert 후 경로 재검증
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, string>
    const entries = Object.entries(body)

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const results = await Promise.all(
      entries.map(([key, value]) =>
        adminClient
          .from('front_settings')
          .upsert({ key, value }, { onConflict: 'key' })
      )
    )

    const failed = results.filter(({ error }) => error)
    if (failed.length > 0) {
      console.error('[settings] upsert errors:', failed.map((f) => f.error))
      return NextResponse.json({ error: 'Failed to save some settings' }, { status: 500 })
    }

    // 메타데이터·푸터가 반영되도록 전체 레이아웃 재검증
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[settings] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
