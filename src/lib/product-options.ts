/**
 * @파일: lib/product-options.ts
 * @설명: 상품 옵션(product_prices 옵션 행) 조회 공용 유틸 — 서버 전용.
 *        /product/[slug] 상세 페이지의 하단 구매 바가 사용한다. 순서(041)·옵션(040) 컬럼 미적용 시
 *        단계적 폴백으로 안전하게 조회하고, sort_order 오름차순으로 정렬해 반환한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** 표시용 옵션 행 하나 (= product_prices 한 행) */
export interface OptionRow {
  axis1Label: string | null
  axis2Label: string | null
  price: number
  checkoutUrl: string
  suffix: string   // '/월' | '/년' | '' (일회성)
}

export interface ProductOptions {
  optionRows: OptionRow[]
  axis1Name: string | null   // 축1 제목 (예: 주기)
  axis2Name: string | null   // 축2 제목 (예: PC 수)
}

/**
 * @함수명: getProductOptions
 * @설명: 상품의 활성 옵션 행을 sort_order 오름차순으로 조회해 표시용 OptionRow[]로 반환합니다.
 *        옵션 라벨이 있는 행만 옵션으로 취급합니다(라벨 없으면 옵션 미사용 상품).
 * @매개변수: client - Supabase 클라이언트, productId - 상품 id
 * @반환값: { optionRows(정렬됨), axis1Name, axis2Name }
 */
export async function getProductOptions(
  client: SupabaseClient,
  productId: string,
): Promise<ProductOptions> {
  const PP_SORT = 'type, interval, price, checkout_url, option_axis1_label, option_axis2_label, sort_order'
  const PP_OPT  = 'type, interval, price, checkout_url, option_axis1_label, option_axis2_label'
  const PP_BASE = 'type, interval, price, checkout_url'
  const by = (sel: string) =>
    client.from('product_prices').select(sel).eq('product_id', productId).eq('is_active', true)

  // 순서(041) → 옵션(040) → 기본 순으로 폴백
  let rows: Array<Record<string, unknown>>
  const r1 = await by(PP_SORT)
  if (!r1.error) rows = (r1.data ?? []) as unknown as Array<Record<string, unknown>>
  else {
    const r2 = await by(PP_OPT)
    rows = ((r2.error ? (await by(PP_BASE)).data : r2.data) ?? []) as unknown as Array<Record<string, unknown>>
  }

  // sort_order 오름차순(값 없으면 뒤로)
  rows = rows.slice().sort((a, b) => {
    const sa = (a.sort_order as number) ?? 999999
    const sb = (b.sort_order as number) ?? 999999
    return sa - sb
  })

  const optionRows: OptionRow[] = rows
    .filter((p) => (p.option_axis1_label as string) || (p.option_axis2_label as string))
    .map((p) => ({
      axis1Label: (p.option_axis1_label as string) ?? null,
      axis2Label: (p.option_axis2_label as string) ?? null,
      price: p.price as number,
      checkoutUrl: (p.checkout_url as string) ?? '#',
      suffix: p.type === 'one_time' ? '' : p.interval === 'annual' ? '/년' : '/월',
    }))

  // 축 제목(products.option_axis*_name) — 040 미적용 시 폴백(null)
  let axis1Name: string | null = null
  let axis2Name: string | null = null
  const nameRes = await client
    .from('products')
    .select('option_axis1_name, option_axis2_name')
    .eq('id', productId)
    .maybeSingle()
  if (!nameRes.error && nameRes.data) {
    axis1Name = (nameRes.data.option_axis1_name as string) ?? null
    axis2Name = (nameRes.data.option_axis2_name as string) ?? null
  }

  return { optionRows, axis1Name, axis2Name }
}
