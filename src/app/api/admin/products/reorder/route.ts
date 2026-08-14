/**
 * @파일: api/admin/products/reorder/route.ts
 * @설명: 제품 순서 변경 API — order_index 일괄 업데이트 후 캐시 재검증
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { isNonEmptyString } from '@/lib/validate'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminActivity } from '@/lib/adminActivityLog'

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.response

    const { ordered } = (await request.json()) as { ordered: string[] }

    if (!Array.isArray(ordered) || ordered.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // 각 id가 유효한 문자열인지 검증 (잘못된 값으로 무의미한 update 실행 방지)
    if (!ordered.every((id) => isNonEmptyString(id))) {
      return NextResponse.json({ error: 'Invalid payload: each id must be a non-empty string' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 감사 기록용 전 순서 — 조회 실패해도 저장은 진행
    let beforeOrder: string[] = []
    try {
      const { data: beforeRows } = await adminClient
        .from('products')
        .select('id')
        .order('order_index', { ascending: true })
      beforeOrder = (beforeRows ?? []).map((r) => r.id as string)
    } catch { /* 전값 없이 기록 */ }

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

    // 감사 기록 — 순서의 전/후(상품 id 목록). 실패해도 본 처리는 이미 성공.
    await logAdminActivity({
      adminUserId: gate.userId,
      action: 'product.reorder',
      targetType: 'product',
      targetId: 'order_index',
      detail: { from: beforeOrder, to: ordered },
    })

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
