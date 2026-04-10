/**
 * @파일: api/admin/sections/toggle/route.ts
 * @설명: 섹션 가시성 토글 API — DB 업데이트 후 랜딩 페이지 캐시 재검증
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  try {
    const { name, is_visible } = (await request.json()) as {
      name: string
      is_visible: boolean
    }

    if (!name || typeof is_visible !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('front_sections')
      .upsert({ name, is_visible }, { onConflict: 'name' })

    if (error) throw error

    // 랜딩 페이지 캐시 즉시 무효화 (일반 사용자 화면에 즉시 반영)
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[sections/toggle]', err)
    return NextResponse.json({ error: 'Failed to toggle section' }, { status: 500 })
  }
}
