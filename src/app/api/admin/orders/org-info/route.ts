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
    const clean = (v: unknown, max = 200) => {
      const s = String(v ?? '').trim().slice(0, max)
      return s || null
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('orders')
      .update({
        org_name:         clean(body.orgName),
        org_biz_reg_no:   clean(body.orgBizRegNo, 20),
        org_contact_name: clean(body.orgContactName, 60),
        tax_invoice_no:   clean(body.taxInvoiceNo, 60),
      })
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

    revalidatePath(`/admin/orders/${body.orderId}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[orders/org-info]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
