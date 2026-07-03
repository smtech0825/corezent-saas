/**
 * @파일: admin/products/new/page.tsx
 * @설명: 신규 제품 등록 페이지
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { validateOptionRows } from '@/lib/product-validation'
import { sanitizeRichHtml } from '@/lib/sanitize-html'
import ProductForm, { type ProductFormData } from '../ProductForm'

export const dynamic = 'force-dynamic'

async function createProduct(data: ProductFormData): Promise<{ error?: string }> {
  'use server'
  // 서버 액션도 관리자만 — 레이아웃 role 체크를 거치지 않으므로 진입부에서 직접 가드
  const gate = await requireAdmin()
  if (!gate.ok) return { error: '관리자 권한이 필요합니다.' }

  // 저장 전 옵션 행 검증(가격·tier·variant·조합/URL 중복) — 서버측 최종 방어
  const invalid = validateOptionRows(data.prices)
  if (invalid) return { error: invalid }

  const client = createAdminClient()

  // 옵션 축 제목(040 컬럼)은 값이 있을 때만 포함 — 미적용·미사용 시 저장이 깨지지 않게
  const productInsert: Record<string, unknown> = {
    name: data.name,
    slug: data.slug,
    tagline: data.tagline || null,
    description: sanitizeRichHtml(data.description) || null,
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
  if (data.option_axis1_name) productInsert.option_axis1_name = data.option_axis1_name
  if (data.option_axis2_name) productInsert.option_axis2_name = data.option_axis2_name

  const { data: product, error } = await client
    .from('products')
    .insert(productInsert)
    .select('id')
    .single()

  if (error) return { error: error.message }

  // 옵션·가격 행 삽입 — 옵션 라벨/tier는 값이 있을 때만 포함(040 미적용 시 미사용 행은 정상)
  if (data.prices.length > 0) {
    const priceRows = data.prices
      .filter((p) => p.price !== '')
      .map((p, i) => {
        const row: Record<string, unknown> = {
          product_id: product.id,
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
        // 표시 순서(041) — 비었으면 입력 순서로 폴백
        const so = parseInt(p.sort_order, 10)
        row.sort_order = Number.isFinite(so) ? so : i + 1
        return row
      })

    if (priceRows.length > 0) {
      let { error: priceError } = await client.from('product_prices').insert(priceRows)
      // sort_order 컬럼(041) 미적용이면 42703 → 컬럼 빼고 재시도(호환)
      if (priceError && (priceError as { code?: string }).code === '42703') {
        const stripped = priceRows.map((r) => { const c = { ...r }; delete c.sort_order; return c })
        ;({ error: priceError } = await client.from('product_prices').insert(stripped))
      }
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
        <Link href="/admin/products" className="text-sm text-ink-faint hover:text-ink-soft transition-colors">
          ← 제품 목록으로
        </Link>
        <h1 className="text-2xl font-bold font-serif text-ink mt-3">새 제품</h1>
        <p className="text-sm text-ink-soft mt-1">카탈로그에 새 소프트웨어 제품을 추가합니다.</p>
      </div>

      <ProductForm onSubmit={createProduct} submitLabel="제품 생성" />
    </div>
  )
}
