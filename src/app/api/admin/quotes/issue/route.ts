/**
 * @파일: api/admin/quotes/issue/route.ts
 * @설명: 견적서 PDF 발급(관리자 전용) — 요청 1건에 대해 PDF를 만들어 내려준다.
 *        발급 전 3중 확인: ① 공급자 정보 7항목이 전부 채워져 있어야 하고(하나라도 비면
 *        무엇이 비었는지 알려주며 차단 — 빈칸 견적서 금지) ② 도장·폰트 파일이 있어야 하며
 *        ③ 단가는 product_prices.price(원)를 그대로 읽는다.
 *        금액 계산(보고됨): 공급가액=단가×수량, 부가세=공급가액의 10% 반올림, 합계=공급+부가세.
 *        견적 번호는 quote_issues의 시퀀스 기본값+UNIQUE — 같은 요청에 여러 번 발급해도
 *        번호는 절대 겹치지 않는다(DB가 채번). 발급하면 상태=quoted, 누가·언제를 기록한다.
 *        ⚠️ 주문·라이선스는 어떤 것도 만들지 않는다(견적은 주문이 아니다).
 */

import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { buildQuotationPdf } from '@/lib/quotation-pdf'

// 공급자 설정 키 ↔ 견적서 항목 이름(빈 항목 안내용)
const COMPANY_KEYS: [string, string][] = [
  ['company_name', '상호(법인명)'],
  ['company_biz_no', '사업자등록번호'],
  ['company_ceo', '대표자'],
  ['company_address', '주소'],
  ['company_biz_type', '업태'],
  ['company_biz_item', '종목'],
  ['company_phone', '전화번호'],
]

const VALID_DAYS = 30 // 견적 유효기간(일) — 대표님 확정값

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.response

    const body = (await request.json().catch(() => null)) as {
      requestId?: string; productPriceId?: string; quantity?: number
    } | null
    if (!body?.requestId || !body?.productPriceId) {
      return NextResponse.json({ error: '요청 정보가 올바르지 않습니다.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1) 견적 요청 확인
    const { data: req } = await admin
      .from('quote_requests')
      .select('id, org_name, department, contact_name, pc_count')
      .eq('id', body.requestId)
      .maybeSingle()
    if (!req) {
      return NextResponse.json({ error: '견적 요청을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 2) 공급자 정보 — 하나라도 비면 발급 차단 + 빈 항목 안내(빈칸 견적서 금지)
    const keys = [...COMPANY_KEYS.map(([k]) => k), 'procurement_item_number', 'procurement_class_number']
    const { data: rows } = await admin.from('front_settings').select('key, value').in('key', keys)
    const map = new Map((rows ?? []).map((r) => [r.key, String(r.value ?? '').trim()]))
    const missing = COMPANY_KEYS.filter(([k]) => !map.get(k)).map(([, label]) => label)
    if (missing.length > 0) {
      return NextResponse.json({
        error: `공급자 정보가 비어 있어 발급할 수 없습니다. 설정 → 견적서 공급자 정보에서 채워 주세요: ${missing.join(', ')}`,
      }, { status: 400 })
    }

    // 3) 도장·폰트 파일 확인 — 없으면 깨진 견적서가 나가므로 차단
    const assetDir = path.join(process.cwd(), 'src', 'assets', 'quotation')
    const required = ['corp-stamp.png', path.join('fonts', 'NanumGothic-Regular.ttf'), path.join('fonts', 'NanumGothic-Bold.ttf')]
    const lost = required.filter((f) => !fs.existsSync(path.join(assetDir, f)))
    if (lost.length > 0) {
      console.error('[quotes/issue] 자산 누락:', lost)
      return NextResponse.json({ error: '도장·글꼴 파일이 없어 발급할 수 없습니다. 관리자에게 문의해 주세요.' }, { status: 500 })
    }

    // 4) 단가 — 상품 가격에서 그대로 읽는다(새 계산 없음)
    const { data: price } = await admin
      .from('product_prices')
      .select('id, price, is_active, option_axis1_label, option_axis2_label, products(name)')
      .eq('id', body.productPriceId)
      .maybeSingle()
    if (!price || price.is_active === false) {
      return NextResponse.json({ error: '상품 옵션을 찾을 수 없습니다.' }, { status: 404 })
    }
    const unitPrice = Number(price.price)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return NextResponse.json({ error: '상품 가격이 올바르지 않아 발급할 수 없습니다.' }, { status: 400 })
    }

    const quantity = Math.trunc(Number(body.quantity ?? req.pc_count))
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      return NextResponse.json({ error: '수량이 올바르지 않습니다.' }, { status: 400 })
    }

    // 금액 — 공급가액=단가×수량 / 부가세=10% 반올림 / 합계 (이 계산 규칙은 보고됨)
    const supply = unitPrice * quantity
    const vat = Math.round(supply * 0.1)
    const total = supply + vat

    // 5) 발급 이력 — 견적 번호는 DB가 채번(UNIQUE — 동시 발급에도 겹칠 수 없음)
    const { data: issue, error: issueErr } = await admin
      .from('quote_issues')
      .insert({ request_id: req.id, issued_by: gate.userId })
      .select('quote_no, issued_at')
      .single()
    if (issueErr || !issue) {
      console.error('[quotes/issue] 발급 이력 생성 실패:', issueErr)
      return NextResponse.json({ error: '발급 기록 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
    }

    // 6) 상태 기록 — 누가 언제 발급했는지 남긴다(견적은 주문이 아니므로 orders는 무접촉)
    await admin
      .from('quote_requests')
      .update({ status: 'quoted', quoted_at: issue.issued_at, quoted_by: gate.userId })
      .eq('id', req.id)

    // 7) PDF 생성
    const prodRaw = (price as Record<string, unknown>).products
    const prod = (Array.isArray(prodRaw) ? prodRaw[0] : prodRaw) as { name?: string } | null
    const spec = [price.option_axis1_label, price.option_axis2_label].filter(Boolean).join(' · ') || '-'
    const issuedAt = new Date(issue.issued_at)
    const validUntil = new Date(issuedAt.getTime() + VALID_DAYS * 24 * 60 * 60 * 1000)

    const pdf = await buildQuotationPdf({
      quoteNo: issue.quote_no,
      issuedAt,
      validUntil,
      recipient: { orgName: req.org_name, department: req.department, contactName: req.contact_name },
      supplier: {
        name: map.get('company_name')!,
        bizNo: map.get('company_biz_no')!,
        ceo: map.get('company_ceo')!,
        address: map.get('company_address')!,
        bizType: map.get('company_biz_type')!,
        bizItem: map.get('company_biz_item')!,
        phone: map.get('company_phone')!,
      },
      item: { productName: prod?.name ?? '-', spec, quantity, unitPrice },
      amounts: { supply, vat, total },
      procurement: {
        itemNumber: map.get('procurement_item_number') || null,
        classNumber: map.get('procurement_class_number') || null,
      },
    })

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${issue.quote_no}.pdf"`,
        'X-Quote-No': issue.quote_no,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[quotes/issue]', err)
    return NextResponse.json({ error: '견적서 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
}
