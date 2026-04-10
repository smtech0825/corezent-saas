/**
 * @파일: admin/products/[id]/edit/page.tsx
 * @설명: 제품 수정 페이지
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import ProductForm, { type ProductFormData, type PriceEntry } from '../../ProductForm'
import ChangelogSection from '../../ChangelogSection'

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
    .select('id, name, slug, tagline, description, category, logo_url, manual_url, is_active, tags, pricing_features, product_features')
    .eq('id', id)
    .single()

  if (!product) notFound()

  // is_active=true 인 가격만 조회 후 type+interval 기준 중복 제거
  const { data: rawPrices } = await client
    .from('product_prices')
    .select('id, type, interval, price, lemon_squeezy_variant_id')
    .eq('product_id', id)
    .eq('is_active', true)
    .order('id', { ascending: true })

  // 기존 changelog 목록 조회
  const { data: rawChangelogs } = await client
    .from('changelogs')
    .select('id, version, release_date, is_latest, download_urls, content')
    .eq('product_id', id)
    .order('release_date', { ascending: false })

  const changelogs = (rawChangelogs ?? []).map((c: any) => ({
    id:            c.id as string,
    version:       c.version as string,
    release_date:  c.release_date as string,
    is_latest:     c.is_latest as boolean,
    download_urls: (c.download_urls ?? {}) as Record<string, string>,
    content: {
      new_features:     ((c.content as any)?.new_features     ?? []) as string[],
      improvements:     ((c.content as any)?.improvements     ?? []) as string[],
      bug_fixes:        ((c.content as any)?.bug_fixes        ?? []) as string[],
      breaking_changes: ((c.content as any)?.breaking_changes ?? []) as string[],
    },
  }))

  const seen = new Set<string>()
  const prices: PriceEntry[] = (rawPrices ?? [])
    .filter((p) => {
      const key = `${p.type}-${p.interval ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((p) => ({
      id: p.id as string,
      type: p.type as 'subscription' | 'one_time',
      interval: (p.interval ?? '') as 'monthly' | 'annual' | '',
      price: String(p.price),
      lemon_squeezy_variant_id: (p.lemon_squeezy_variant_id as string) ?? '',
    }))

  const initialData: ProductFormData = {
    name: product.name ?? '',
    slug: product.slug ?? '',
    tagline: product.tagline ?? '',
    description: product.description ?? '',
    category: product.category ?? 'desktop',
    logo_url: product.logo_url ?? '',
    manual_url: product.manual_url ?? '',
    is_active: product.is_active ?? true,
    tags: (product.tags ?? []) as string[],
    pricing_features: (product.pricing_features ?? []) as string[],
    product_features: (product.product_features ?? []) as Array<{ icon: string; image_url: string; title: string; description: string }>,
    prices,
  }

  async function updateProduct(data: ProductFormData): Promise<{ error?: string }> {
    'use server'
    const c = createAdminClient()

    // 상품 기본 정보 업데이트
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
        tags: data.tags.filter(Boolean),
        pricing_features: data.pricing_features.filter(Boolean),
        product_features: data.product_features.filter((f) => f.title),
      })
      .eq('id', id)

    if (error) return { error: error.message }

    // 현재 DB의 모든 is_active 가격 ID 조회
    const { data: currentPrices } = await c
      .from('product_prices')
      .select('id')
      .eq('product_id', id)
      .eq('is_active', true)

    const currentIds = new Set((currentPrices ?? []).map((p: any) => p.id as string))
    const formIds = new Set(data.prices.filter((p) => p.id).map((p) => p.id as string))

    // 폼에서 제거된 가격 → is_active=false (orders FK 참조 때문에 삭제 불가)
    const toDeactivate = [...currentIds].filter((pid) => !formIds.has(pid))
    if (toDeactivate.length > 0) {
      await c.from('product_prices').update({ is_active: false }).in('id', toDeactivate)
    }

    // 기존 가격 업데이트 (ID 있는 항목)
    for (const price of data.prices.filter((p) => p.id && p.price !== '')) {
      await c
        .from('product_prices')
        .update({
          type: price.type,
          interval: price.type === 'subscription' ? price.interval || null : null,
          price: parseFloat(price.price),
          lemon_squeezy_variant_id: price.lemon_squeezy_variant_id || null,
          is_active: true,
        })
        .eq('id', price.id!)
    }

    // 신규 가격 삽입 (ID 없는 항목)
    const newPrices = data.prices.filter((p) => !p.id && p.price !== '')
    if (newPrices.length > 0) {
      const { error: insertError } = await c.from('product_prices').insert(
        newPrices.map((p) => ({
          product_id: id,
          type: p.type,
          interval: p.type === 'subscription' ? p.interval || null : null,
          price: parseFloat(p.price),
          lemon_squeezy_variant_id: p.lemon_squeezy_variant_id || null,
          is_active: true,
        }))
      )
      if (insertError) return { error: insertError.message }
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

      <ChangelogSection productId={id} initialChangelogs={changelogs} />
    </div>
  )
}
