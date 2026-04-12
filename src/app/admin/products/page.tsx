/**
 * @파일: admin/products/page.tsx
 * @설명: 관리자 제품 관리 — 제품 목록 + 순서 변경(위/아래 화살표) + 추가/수정/삭제
 */

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { Plus } from 'lucide-react'
import ProductList, { type ProductRow } from './ProductList'

export const dynamic = 'force-dynamic'

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

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
    .select('id, name, slug, category, tagline, is_active, order_index, product_prices(type, interval, price)')
    .order('order_index', { ascending: true })

  const list: ProductRow[] = (products ?? []).map((p) => {
    const prices = (p.product_prices ?? []) as { type: string; interval: string; price: number }[]
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
      monthlyLabel:  monthly ? fmtCurrency(monthly.price) + '/mo' : oneTime ? fmtCurrency(oneTime.price) + ' once' : '—',
      annualLabel:   annual ? fmtCurrency(annual.price) + '/yr' : '—',
    }
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{list.length} products · Reorder with arrows</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={15} /> Add Product
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl py-16 text-center space-y-3">
          <p className="text-sm text-[#475569]">No products yet.</p>
          <Link href="/admin/products/new" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
            + Add your first product
          </Link>
        </div>
      ) : (
        <ProductList products={list} onDelete={deleteProduct} />
      )}
    </div>
  )
}
