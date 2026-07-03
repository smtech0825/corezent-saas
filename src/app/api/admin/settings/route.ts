/**
 * @파일: api/admin/settings/route.ts
 * @설명: 사이트 설정 저장 API — front_settings 테이블 upsert 후 경로 재검증
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.response

    const body = await request.json() as Record<string, string>
    const entries = Object.entries(body)

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 })
    }

    // 모든 키·값이 문자열인지 검증 (키/값 문자열이 아닌 페이로드로 upsert 오염 방지)
    const invalid = entries.some(
      ([key, value]) => typeof key !== 'string' || key.length === 0 || typeof value !== 'string',
    )
    if (invalid) {
      return NextResponse.json({ error: 'Invalid payload: keys and values must be strings' }, { status: 400 })
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
