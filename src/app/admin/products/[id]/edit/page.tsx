/**
 * @파일: admin/products/[id]/edit/page.tsx
 * @설명: 제품 수정 페이지
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { validateOptionRows } from '@/lib/product-validation'
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

  // is_active=true 인 가격(옵션 행) 조회. 옵션 컬럼(040)·순서 컬럼(041)은 best-effort — 미적용 시 단계적 폴백.
  const PRICE_SORT = 'id, type, interval, price, lemon_squeezy_variant_id, checkout_url, option_axis1_label, option_axis2_label, license_tier, sort_order'
  const PRICE_OPT  = 'id, type, interval, price, lemon_squeezy_variant_id, checkout_url, option_axis1_label, option_axis2_label, license_tier'
  const PRICE_BASE = 'id, type, interval, price, lemon_squeezy_variant_id, checkout_url'
  const priceBy = (sel: string) => client.from('product_prices').select(sel).eq('product_id', id).eq('is_active', true)
  let rawPrices: Array<Record<string, unknown>>
  const rSort = await priceBy(PRICE_SORT)
  if (!rSort.error) rawPrices = (rSort.data ?? []) as unknown as Array<Record<string, unknown>>
  else {
    const rOpt = await priceBy(PRICE_OPT)
    rawPrices = ((rOpt.error
      ? (await priceBy(PRICE_BASE)).data
      : rOpt.data) ?? []) as unknown as Array<Record<string, unknown>>
  }
  // 표시 순서(sort_order) 오름차순 → 값 없으면 뒤로, 동률이면 id 안정 정렬
  rawPrices = rawPrices.slice().sort((a, b) => {
    const sa = (a.sort_order as number) ?? 999999
    const sb = (b.sort_order as number) ?? 999999
    return sa !== sb ? sa - sb : String(a.id).localeCompare(String(b.id))
  })

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
    sort_order: (() => {
      const v = (p as { sort_order?: number | null }).sort_order
      return v == null ? '' : String(v)
    })(),
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
    // 서버 액션도 관리자만 — 레이아웃 role 체크를 거치지 않으므로 진입부에서 직접 가드
    const gate = await requireAdmin()
    if (!gate.ok) return { error: '관리자 권한이 필요합니다.' }

    // 저장 전 옵션 행 검증(가격·tier·variant·조합/URL 중복) — 서버측 최종 방어
    const invalid = validateOptionRows(data.prices)
    if (invalid) return { error: invalid }

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
      const so = parseInt(price.sort_order, 10)
      if (Number.isFinite(so)) priceUpdate.sort_order = so

      let { data: updated, error: updateError } = await c
        .from('product_prices')
        .update(priceUpdate)
        .eq('id', price.id!)
        .select('id')
      // sort_order 컬럼(041) 미적용이면 42703 → 컬럼 빼고 재시도(호환)
      if (updateError && (updateError as { code?: string }).code === '42703') {
        const stripped = { ...priceUpdate }; delete stripped.sort_order
        ;({ data: updated, error: updateError } = await c
          .from('product_prices').update(stripped).eq('id', price.id!).select('id'))
      }
      if (updateError) return { error: updateError.message }
      if (!updated || updated.length === 0) {
        return { error: `가격 항목(id=${price.id})을 찾지 못해 저장에 실패했습니다.` }
      }
    }

    // 신규 옵션·가격 삽입 (ID 없는 항목)
    const newPrices = data.prices.filter((p) => !p.id && p.price !== '')
    if (newPrices.length > 0) {
      const rows = newPrices.map((p, i) => {
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
        const so = parseInt(p.sort_order, 10)
        row.sort_order = Number.isFinite(so) ? so : i + 1
        return row
      })
      let { error: insertError } = await c.from('product_prices').insert(rows)
      // sort_order 컬럼(041) 미적용이면 42703 → 컬럼 빼고 재시도(호환)
      if (insertError && (insertError as { code?: string }).code === '42703') {
        const stripped = rows.map((r) => { const cc = { ...r }; delete cc.sort_order; return cc })
        ;({ error: insertError } = await c.from('product_prices').insert(stripped))
      }
      if (insertError) return { error: insertError.message }
    }

    revalidatePath('/admin/products')
    revalidatePath(`/admin/products/${id}/edit`)
    return {}
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-ink-faint hover:text-ink-soft transition-colors">
          ← 제품 목록으로
        </Link>
        <h1 className="text-2xl font-bold font-serif text-ink mt-3">제품 편집</h1>
        <p className="text-sm text-ink-soft mt-1">{product.name}</p>
      </div>

      <ProductForm initialData={initialData} onSubmit={updateProduct} submitLabel="변경사항 저장" />

      <ChangelogSection productId={id} initialChangelogs={changelogs} />
    </div>
  )
}
