/**
 * @파일: admin/content/product-features/page.tsx
 * @설명: /product 페이지에 표시될 상품별 특징(features) 관리
 *        상품을 선택하고 "More Info" 확장 시 보여줄 특징 목록을 편집
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import ProductFeaturesManager from './ProductFeaturesManager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Product Features — Admin',
}

async function saveFeatures(
  productId: string,
  features: string[]
): Promise<{ error?: string }> {
  'use server'
  const client = createAdminClient()

  const { error } = await client
    .from('products')
    .update({ features })
    .eq('id', productId)

  if (error) return { error: error.message }

  revalidatePath('/product')
  revalidatePath('/admin/content/product-features')
  return {}
}

export default async function ProductFeaturesPage() {
  const client = createAdminClient()

  const { data: products } = await client
    .from('products')
    .select('id, name, features')
    .order('order_index', { ascending: true })

  const mapped = (products ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    features: (p.features ?? []) as string[],
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Product Features</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          각 상품의 &quot;More Info&quot; 확장 시 표시될 특징 목록을 관리합니다.
          변경 사항은 즉시{' '}
          <a href="/product" target="_blank" className="text-[#38BDF8] underline underline-offset-2">
            /product
          </a>{' '}
          페이지에 반영됩니다.
        </p>
      </div>

      <ProductFeaturesManager products={mapped} onSave={saveFeatures} />
    </div>
  )
}
