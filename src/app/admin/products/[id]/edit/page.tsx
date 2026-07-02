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

  // 옵션 축 제목 컬럼(040)은 우선 조회 → 미적용 시 폴백(옵션 필드 없이 편집 페이지 정상 동작)
  const OPT_SEL = 'id, name, slug, tagline, description, category, category_group, option_axis1_name, option_axis2_name, badge_text, badge_color, logo_url, manual_url, is_active, tags, pricing_features, product_features, hero_image_url, screenshots, system_requirements, version_info_url, faqs'
  const BASE_SEL = 'id, name, slug, tagline, description, category, category_group, badge_text, badge_color, logo_url, manual_url, is_active, tags, pricing_features, product_features, hero_image_url, screenshots, system_requirements, version_info_url, faqs'

  const optRes = await client.from('products').select(OPT_SEL).eq('id', id).single()
  const { data: product } = optRes.error
    ? await client.from('products').select(BASE_SEL).eq('id', id).single()
    : optRes

  if (!product) notFound()

  // is_active=true 인 가격(옵션 행) 조회. 옵션 컬럼(040)은 best-effort — 미적용 시 폴백.
  const PRICE_OPT = 'id, type, interval, price, lemon_squeezy_variant_id, checkout_url, option_axis1_label, option_axis2_label, license_tier'
  const PRICE_BASE = 'id, type, interval, price, lemon_squeezy_variant_id, checkout_url'
  const rawPricesRes = await client
    .from('product_prices')
    .select(PRICE_OPT)
    .eq('product_id', id)
    .eq('is_active', true)
    .order('id', { ascending: true })
  const rawPrices = rawPricesRes.error
    ? (await client.from('product_prices').select(PRICE_BASE).eq('product_id', id).eq('is_active', true).order('id', { ascending: true })).data
    : rawPricesRes.data

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

  // v2: 옵션 행은 같은 (type, interval)에 tier별로 여러 개 존재 가능 → dedup 하지 않고 전부 표시.
  const prices: PriceEntry[] = (rawPrices ?? []).map((p) => ({
    id: p.id as string,
    type: p.type as 'subscription' | 'one_time',
    interval: (p.interval ?? '') as 'monthly' | 'annual' | '',
    price: String(p.price),
    lemon_squeezy_variant_id: (p.lemon_squeezy_variant_id as string) ?? '',
    checkout_url: (p.checkout_url as string) ?? '',
    option_axis1_label: ((p as { option_axis1_label?: string | null }).option_axis1_label) ?? '',
    option_axis2_label: ((p as { option_axis2_label?: string | null }).option_axis2_label) ?? '',
    license_tier: ((p as { license_tier?: string | null }).license_tier) ?? '',
  }))

  const initialData: ProductFormData = {
    name: product.name ?? '',
    slug: product.slug ?? '',
    tagline: product.tagline ?? '',
    description: product.description ?? '',
    category: product.category ?? 'desktop',
    category_group: (product.category_group as string) ?? '',
    // 폴백(040 미적용) 시 컬럼이 없으므로 옵셔널로 안전 접근
    option_axis1_name: ((product as { option_axis1_name?: string | null }).option_axis1_name) ?? '',
    option_axis2_name: ((product as { option_axis2_name?: string | null }).option_axis2_name) ?? '',
    badge_text: (product.badge_text as string) ?? '',
    badge_color: ((product.badge_color as string) ?? 'blue') as 'blue' | 'green' | 'yellow',
    logo_url: product.logo_url ?? '',
    manual_url: product.manual_url ?? '',
    is_active: product.is_active ?? true,
    tags: (product.tags ?? []) as string[],
    pricing_features: (product.pricing_features ?? []) as string[],
    product_features: (product.product_features ?? []) as Array<{ icon: string; image_url: string; title: string; description: string }>,
    hero_image_url: (product.hero_image_url as string) ?? '',
    screenshots: (product.screenshots ?? []) as string[],
    system_requirements: (product.system_requirements as string) ?? '',
    version_info_url: (product.version_info_url as string) ?? '',
    faqs: (product.faqs ?? []) as { question: string; answer: string }[],
    prices,
  }

  async function updateProduct(data: ProductFormData): Promise<{ error?: string }> {
    'use server'
    const c = createAdminClient()

    // 상품 기본 정보 업데이트 — 옵션 축 제목(040 컬럼)은 값 있을 때만 포함(미적용·미사용 호환)
    const productUpdate: Record<string, unknown> = {
      name: data.name,
      slug: data.slug,
      tagline: data.tagline || null,
      description: data.description || null,
      category: data.category,
      category_group: data.category_group || null,
      badge_text: data.badge_text || null,
      badge_color: data.badge_color,
      logo_url: data.logo_url || null,
      manual_url: data.manual_url || null,
      is_active: data.is_active,
      tags: data.tags.filter(Boolean),
      pricing_features: data.pricing_features.filter(Boolean),
      product_features: data.product_features.filter((f) => f.title),
      hero_image_url: data.hero_image_url || null,
      screenshots: data.screenshots.filter(Boolean),
      system_requirements: data.system_requirements || null,
      version_info_url: data.version_info_url || null,
      faqs: data.faqs.filter((f) => f.question.trim() || f.answer.trim()),
    }
    if (data.option_axis1_name) productUpdate.option_axis1_name = data.option_axis1_name
    if (data.option_axis2_name) productUpdate.option_axis2_name = data.option_axis2_name

    const { error } = await c.from('products').update(productUpdate).eq('id', id)

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
      const { error: deactivateError } = await c
        .from('product_prices')
        .update({ is_active: false })
        .in('id', toDeactivate)
      if (deactivateError) return { error: deactivateError.message }
    }

    // 기존 옵션·가격 업데이트 (ID 있는 항목) — 에러·0행 매칭을 표면화 (돈 경로: 조용히 삼키지 않음)
    // 옵션 라벨/tier(040 컬럼)는 값 있을 때만 포함 — 미적용·미사용 행은 정상 저장.
    for (const price of data.prices.filter((p) => p.id && p.price !== '')) {
      const priceUpdate: Record<string, unknown> = {
        type: price.type,
        interval: price.type === 'subscription' ? price.interval || null : null,
        price: parseFloat(price.price),
        lemon_squeezy_variant_id: price.lemon_squeezy_variant_id || null,
        checkout_url: price.checkout_url || null,
        is_active: true,
      }
      if (price.option_axis1_label) priceUpdate.option_axis1_label = price.option_axis1_label
      if (price.option_axis2_label) priceUpdate.option_axis2_label = price.option_axis2_label
      if (price.license_tier) priceUpdate.license_tier = price.license_tier

      const { data: updated, error: updateError } = await c
        .from('product_prices')
        .update(priceUpdate)
        .eq('id', price.id!)
        .select('id')
      if (updateError) return { error: updateError.message }
      if (!updated || updated.length === 0) {
        return { error: `가격 항목(id=${price.id})을 찾지 못해 저장에 실패했습니다.` }
      }
    }

    // 신규 옵션·가격 삽입 (ID 없는 항목)
    const newPrices = data.prices.filter((p) => !p.id && p.price !== '')
    if (newPrices.length > 0) {
      const { error: insertError } = await c.from('product_prices').insert(
        newPrices.map((p) => {
          const row: Record<string, unknown> = {
            product_id: id,
            type: p.type,
            interval: p.type === 'subscription' ? p.interval || null : null,
            price: parseFloat(p.price),
            lemon_squeezy_variant_id: p.lemon_squeezy_variant_id || null,
            checkout_url: p.checkout_url || null,
            is_active: true,
          }
          if (p.option_axis1_label) row.option_axis1_label = p.option_axis1_label
          if (p.option_axis2_label) row.option_axis2_label = p.option_axis2_label
          if (p.license_tier) row.license_tier = p.license_tier
          return row
        })
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
        <Link href="/admin/products" className="text-sm text-[#94A3B8] hover:text-[#E2E8F0] transition-colors">
          ← 제품 목록으로
        </Link>
        <h1 className="text-2xl font-bold text-white mt-3">제품 편집</h1>
        <p className="text-sm text-[#E2E8F0] mt-1">{product.name}</p>
      </div>

      <ProductForm initialData={initialData} onSubmit={updateProduct} submitLabel="변경사항 저장" />

      <ChangelogSection productId={id} initialChangelogs={changelogs} />
    </div>
  )
}
