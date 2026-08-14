/**
 * @파일: api/admin/orders/org-info/route.ts
 * @설명: 주문의 기관 구매 정보 4칸(기관명·사업자번호·담당자·세금계산서 번호) 저장 — 관리자 전용.
 *        전부 선택 입력이다(개인 주문에는 쓰지 않는 칸 — 빈 값은 null로 저장).
 *        주문의 금액·상태·결제 관련 값은 절대 건드리지 않는다(이 4칸만 UPDATE).
 *        061 마이그레이션 미적용(42703)이면 그 사실을 구분해 알려준다.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePath } from 'next/cache'
import { logAdminActivity } from '@/lib/adminActivityLog'

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.response

    const body = (await request.json().catch(() => null)) as {
      orderId?: string
      orgName?: string; orgBizRegNo?: string; orgContactName?: string; taxInvoiceNo?: string
    } | null
    if (!body?.orderId) {
      return NextResponse.json({ error: '요청 정보가 올바르지 않습니다.' }, { status: 400 })
    }
    /** 입력값 정리 — trim + 길이 제한, 빈 값은 null(칸 비우기 = 지우기) */
    const clean = (v: unknown, max = 200) => {
      const s = String(v ?? '').trim().slice(0, max)
      return s || null
    }

    const admin = createAdminClient()

    // 감사 기록용 전값 — 조회 실패해도 저장은 진행(061 미적용이면 아래 update가 안내)
    let before: Record<string, string | null> | null = null
    try {
      const { data: b } = await admin
        .from('orders')
        .select('org_name, org_biz_reg_no, org_contact_name, tax_invoice_no')
        .eq('id', body.orderId)
        .maybeSingle()
      before = (b as Record<string, string | null>) ?? null
    } catch { /* 전값 없이 기록 */ }

    const after = {
      org_name:         clean(body.orgName),
      org_biz_reg_no:   clean(body.orgBizRegNo, 20),
      org_contact_name: clean(body.orgContactName, 60),
      tax_invoice_no:   clean(body.taxInvoiceNo, 60),
    }
    const { error } = await admin
      .from('orders')
      .update(after)
      .eq('id', body.orderId)

    if (error) {
      console.error('[orders/org-info] update error:', error)
      const notApplied = error.code === '42703' || /column .* does not exist/i.test(error.message ?? '')
      return NextResponse.json({
        error: notApplied
          ? '기관 정보 칸이 아직 준비되지 않았습니다. supabase/migrations/061_orders_org_info.sql 을 먼저 적용해 주세요.'
          : '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      }, { status: 500 })
    }

    // 감사 기록 — 기관 정보 4칸의 전/후(짧은 값 그대로. 실패해도 저장은 이미 성공)
    await logAdminActivity({
      adminUserId: gate.userId,
      action: 'order.org_info_update',
      targetType: 'order',
      targetId: body.orderId,
      detail: { from: before, to: after },
    })

    revalidatePath(`/admin/orders/${body.orderId}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[orders/org-info]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
