/**
 * @파일: admin/products/page.tsx
 * @설명: 관리자 제품 관리 — 제품 목록 + 순서 변경(위/아래 화살표) + 추가/수정/삭제
 */

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { Plus } from 'lucide-react'
import ProductList, { type ProductRow } from './ProductList'
import { formatPrice } from '@/lib/price'

export const dynamic = 'force-dynamic'

async function deleteProduct(id: string) {
  'use server'
  const client = createAdminClient()
  await client.from('products').delete().eq('id', id)
  revalidatePath('/admin/products')
}

export default async function ProductsPage() {
  const adminClient = createAdminClient()

  const { data: products } = await adminClient
    .from('products')
    .select('id, name, slug, category, tagline, is_active, order_index, product_prices(type, interval, price, is_active)')
    .order('order_index', { ascending: true })

  const list: ProductRow[] = (products ?? []).map((p) => {
    // 활성 가격만 사용 — 비활성(과거) 행을 집어 옛 가격이 표시되는 문제 방지
    // (공개 페이지·편집 페이지와 동일하게 is_active 필터)
    const prices = ((p.product_prices ?? []) as { type: string; interval: string; price: number; is_active: boolean }[])
      .filter((pr) => pr.is_active)
    const monthly = prices.find((pr) => pr.interval === 'monthly')
    const annual = prices.find((pr) => pr.interval === 'annual')
    const oneTime = prices.find((pr) => pr.type === 'one_time')
    return {
      id:            p.id,
      name:          p.name,
      slug:          p.slug,
      category:      p.category,
      tagline:       p.tagline ?? '',
      is_active:     p.is_active !== false,
      monthlyLabel:  monthly ? formatPrice(monthly.price) + '/mo' : oneTime ? formatPrice(oneTime.price) + ' once' : '—',
      annualLabel:   annual ? formatPrice(annual.price) + '/yr' : '—',
    }
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">제품</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{list.length}개 제품 · 화살표로 순서 변경</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={15} /> 제품 추가
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl py-16 text-center space-y-3">
          <p className="text-sm text-[#475569]">아직 제품이 없습니다.</p>
          <Link href="/admin/products/new" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
            + 첫 제품 추가하기
          </Link>
        </div>
      ) : (
        <ProductList products={list} onDelete={deleteProduct} />
      )}
    </div>
  )
}
