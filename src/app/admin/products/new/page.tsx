/**
 * @파일: admin/products/new/page.tsx
 * @설명: 신규 제품 등록 페이지
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import ProductForm, { type ProductFormData } from '../ProductForm'

export const dynamic = 'force-dynamic'

async function createProduct(data: ProductFormData): Promise<{ error?: string }> {
  'use server'
  const client = createAdminClient()

  const { data: product, error } = await client
    .from('products')
    .insert({
      name: data.name,
      slug: data.slug,
      tagline: data.tagline || null,
      description: data.description || null,
      category: data.category,
      logo_url: data.logo_url || null,
      manual_url: data.manual_url || null,
      is_active: data.is_active,
      tags: data.tags.filter(Boolean),
      pricing_features: data.pricing_features.filter(Boolean),
      product_features: data.product_features.filter((f) => f.title),
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // 가격 플랜 삽입
  if (data.prices.length > 0) {
    const priceRows = data.prices
      .filter((p) => p.price !== '')
      .map((p) => ({
        product_id: product.id,
        type: p.type,
        interval: p.type === 'subscription' ? p.interval || null : null,
        price: parseFloat(p.price),
        is_active: true,
      }))

    if (priceRows.length > 0) {
      const { error: priceError } = await client.from('product_prices').insert(priceRows)
      if (priceError) return { error: priceError.message }
    }
  }

  revalidatePath('/admin/products')
  return {}
}

export default function NewProductPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-[#475569] hover:text-[#94A3B8] transition-colors">
          ← Back to Products
        </Link>
        <h1 className="text-2xl font-bold text-white mt-3">New Product</h1>
        <p className="text-sm text-[#94A3B8] mt-1">Add a new software product to your catalog.</p>
      </div>

      <ProductForm onSubmit={createProduct} submitLabel="Create Product" />
    </div>
  )
}
