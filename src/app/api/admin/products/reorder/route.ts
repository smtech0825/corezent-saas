/**
 * @파일: api/admin/products/reorder/route.ts
 * @설명: 제품 순서 변경 API — order_index 일괄 업데이트 후 캐시 재검증
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

    const results = await Promise.all(
      ordered.map((id, idx) =>
        adminClient
          .from('products')
          .update({ order_index: idx })
          .eq('id', id),
      ),
    )

    const failed = results.filter(({ error }) => error)
    if (failed.length > 0) {
      console.error('[products/reorder] errors:', failed.map((f) => f.error))
      throw new Error('Some order updates failed')
    }

    // 제품 페이지 + 가격 페이지 캐시 무효화
    revalidatePath('/product', 'layout')
    revalidatePath('/pricing', 'layout')
    revalidatePath('/admin/products', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[products/reorder]', err)
    return NextResponse.json({ error: 'Failed to reorder products' }, { status: 500 })
  }
}
