/**
 * @파일: admin/products/[id]/edit/page.tsx
 * @설명: 제품 수정 페이지
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import ProductForm, { type ProductFormData, type PriceEntry } from '../../ProductForm'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = createAdminClient()

  const { data: product } = await client
    .from('products')
    .select('*, product_prices(id, type, interval, price)')
    .eq('id', id)
    .single()

  if (!product) notFound()

  const prices: PriceEntry[] = (product.product_prices ?? []).map(
    (p: { id: string; type: string; interval: string | null; price: number }) => ({
      id: p.id,
      type: p.type as 'subscription' | 'one_time',
      interval: (p.interval ?? '') as 'monthly' | 'annual' | '',
      price: String(p.price),
    })
  )

  const initialData: ProductFormData = {
    name: product.name ?? '',
    slug: product.slug ?? '',
    tagline: product.tagline ?? '',
    description: product.description ?? '',
    category: product.category ?? 'desktop',
    logo_url: product.logo_url ?? '',
    manual_url: product.manual_url ?? '',
    is_active: product.is_active ?? true,
    prices,
  }

  async function updateProduct(data: ProductFormData): Promise<{ error?: string }> {
    'use server'
    const c = createAdminClient()

    const { error } = await c
      .from('products')
      .update({
        name: data.name,
        slug: data.slug,
        tagline: data.tagline || null,
        description: data.description || null,
        category: data.category,
        logo_url: data.logo_url || null,
        manual_url: data.manual_url || null,
        is_active: data.is_active,
      })
      .eq('id', id)

    if (error) return { error: error.message }

    // 기존 가격 전체 삭제 — 실패 시 중단 (삭제 없이 insert하면 중복 발생)
    const { error: deleteError } = await c
      .from('product_prices')
      .delete()
      .eq('product_id', id)

    if (deleteError) return { error: `가격 초기화 실패: ${deleteError.message}` }

    const priceRows = data.prices
      .filter((p) => p.price !== '')
      .map((p) => ({
        product_id: id,
        type: p.type,
        interval: p.type === 'subscription' ? p.interval || null : null,
        price: parseFloat(p.price),
        is_active: true,
      }))

    if (priceRows.length > 0) {
      const { error: priceError } = await c.from('product_prices').insert(priceRows)
      if (priceError) return { error: priceError.message }
    }

    revalidatePath('/admin/products')
    revalidatePath(`/admin/products/${id}/edit`)
    return {}
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-[#475569] hover:text-[#94A3B8] transition-colors">
          ← Back to Products
        </Link>
        <h1 className="text-2xl font-bold text-white mt-3">Edit Product</h1>
        <p className="text-sm text-[#94A3B8] mt-1">{product.name}</p>
      </div>

      <ProductForm initialData={initialData} onSubmit={updateProduct} submitLabel="Save Changes" />
    </div>
  )
}
