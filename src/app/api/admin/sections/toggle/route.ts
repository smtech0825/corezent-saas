/**
 * @파일: api/admin/sections/toggle/route.ts
 * @설명: 섹션 가시성 토글 API — upsert로 행 없으면 자동 생성, 캐시 재검증
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  try {
    const { name, is_visible, label, order_index } = (await request.json()) as {
      name: string
      is_visible: boolean
      label: string
      order_index: number
    }

    if (!name || typeof is_visible !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // upsert: 행이 없으면 INSERT, 있으면 UPDATE (label·order_index 포함으로 NOT NULL 제약 충족)
    const { error } = await adminClient
      .from('front_sections')
      .upsert(
        { name, is_visible, label: label || name, order_index: order_index ?? 0 },
        { onConflict: 'name' },
      )

    if (error) throw error

    // 랜딩 페이지 캐시 즉시 무효화
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[sections/toggle]', err)
    return NextResponse.json({ error: 'Failed to toggle section' }, { status: 500 })
  }
}
