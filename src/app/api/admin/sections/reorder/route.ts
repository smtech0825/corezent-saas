/**
 * @파일: api/admin/sections/reorder/route.ts
 * @설명: 섹션 순서 변경 API — order_index 일괄 업데이트 후 랜딩 페이지 캐시 재검증
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  try {
    const { ordered } = (await request.json()) as { ordered: string[] }

    if (!Array.isArray(ordered) || ordered.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 배열 순서(index)를 order_index로 저장
    const results = await Promise.all(
      ordered.map((name, idx) =>
        adminClient
          .from('front_sections')
          .upsert({ name, order_index: idx }, { onConflict: 'name' })
      )
    )

    const failed = results.filter(({ error }) => error)
    if (failed.length > 0) {
      console.error('[sections/reorder] partial failure:', failed.map((f) => f.error))
      throw new Error('Some order updates failed')
    }

    // 랜딩 페이지 캐시 즉시 무효화 (변경된 순서 즉시 반영)
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[sections/reorder]', err)
    return NextResponse.json({ error: 'Failed to reorder sections' }, { status: 500 })
  }
}
