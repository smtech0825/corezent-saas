/**
 * @파일: admin/products/page.tsx
 * @설명: 관리자 제품 관리 — 제품 목록, 추가/수정/삭제
 */

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { Pencil, Plus } from 'lucide-react'
import DeleteButton from './DeleteButton'

export const dynamic = 'force-dynamic'

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const categoryColors: Record<string, string> = {
  desktop: 'text-violet-400 bg-violet-400/10',
  web: 'text-[#38BDF8] bg-[#38BDF8]/10',
  'chrome-extension': 'text-amber-400 bg-amber-400/10',
  mobile: 'text-emerald-400 bg-emerald-400/10',
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
    .select('id, name, slug, category, tagline, is_active, product_prices(type, interval, price)')
    .order('order_index', { ascending: true })

  const list = products ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{list.length} products</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={15} /> Add Product
        </Link>
      </div>

      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        {list.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-[#475569]">No products yet.</p>
            <Link href="/admin/products/new" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
              + Add your first product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  <th className="text-left px-6 py-3 text-xs text-[#475569] font-medium">Product</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Monthly</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Annual</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-[#475569] font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const prices = (p.product_prices ?? []) as { type: string; interval: string; price: number }[]
                  const monthly = prices.find((pr) => pr.interval === 'monthly')
                  const annual = prices.find((pr) => pr.interval === 'annual')
                  const oneTime = prices.find((pr) => pr.type === 'one_time')
                  return (
                    <tr key={p.id} className="border-b border-[#1E293B]/50 hover:bg-[#0B1120]/40 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-white">{p.name}</p>
                        <p className="text-xs text-[#475569] mt-0.5">{p.tagline}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${categoryColors[p.category] ?? 'text-[#94A3B8] bg-[#1E293B]'}`}>
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[#94A3B8]">
                        {monthly ? fmtCurrency(monthly.price) + '/mo' : oneTime ? fmtCurrency(oneTime.price) + ' once' : '—'}
                      </td>
                      <td className="px-4 py-4 text-[#94A3B8]">
                        {annual ? fmtCurrency(annual.price) + '/yr' : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          p.is_active !== false ? 'text-emerald-400 bg-emerald-400/10' : 'text-[#475569] bg-[#1E293B]'
                        }`}>
                          {p.is_active !== false ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/admin/products/${p.id}/edit`}
                            className="p-1.5 text-[#475569] hover:text-amber-400 transition-colors rounded"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </Link>
                          <DeleteButton
                            productId={p.id}
                            productName={p.name}
                            onDelete={deleteProduct}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
