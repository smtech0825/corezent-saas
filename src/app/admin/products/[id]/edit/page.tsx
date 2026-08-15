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
import { sanitizeRichHtml } from '@/lib/sanitize-html'
import { logAdminActivity, summarizeForLog, buildChangeDetail } from '@/lib/adminActivityLog'
import ProductForm, { type ProductFormData, type PriceEntry } from '../../ProductForm'
import ChangelogSection from '../../ChangelogSection'
import PageContainer from '@/components/common/PageContainer'

export const dynamic = 'force-dynamic'

/**
 * @함수명: isMissingColumnError
 * @설명: 조달청 등록번호 컬럼(054)이 아직 적용되지 않은 DB에서 나는 오류인지 판별합니다.
 *        select는 42703(undefined column), insert/update 페이로드는 PGRST204(스키마 캐시에 없음)로 온다.
 * @매개변수: err - Supabase가 돌려준 오류 객체
 * @반환값: 컬럼이 없어서 난 오류면 true
 */
function isMissingColumnError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code
  return code === '42703' || code === 'PGRST204'
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = createAdminClient()

  // 옵션 축 제목 컬럼(040)은 우선 조회 → 미적용 시 폴백(옵션 필드 없이 편집 페이지 정상 동작)
  // 조달청 등록번호(054)도 OPT_SEL에만 넣는다 — 미적용 환경에서는 BASE_SEL 폴백으로 편집 페이지가 계속 열린다
  const OPT_SEL = 'id, name, slug, tagline, list_description, description, category, category_group, option_axis1_name, option_axis2_name, badge_text, badge_color, logo_url, manual_url, procurement_class_number, procurement_item_number, is_active, tags, pricing_features, product_features, hero_image_url, screenshots, system_requirements, version_info_url, faqs'
  const BASE_SEL = 'id, name, slug, tagline, list_description, description, category, category_group, badge_text, badge_color, logo_url, manual_url, is_active, tags, pricing_features, product_features, hero_image_url, screenshots, system_requirements, version_info_url, faqs'

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
    list_description: (product.list_description as string) ?? '',
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
    // 폴백(054 미적용) 시 컬럼이 없으므로 옵셔널로 안전 접근
    procurement_class_number: ((product as { procurement_class_number?: string | null }).procurement_class_number) ?? '',
    procurement_item_number: ((product as { procurement_item_number?: string | null }).procurement_item_number) ?? '',
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
      // 목록 전용 짧은 소개(plain text, NOT NULL DEFAULT '') — 상세 description과 별개
      list_description: data.list_description || '',
      description: sanitizeRichHtml(data.description) || null,
      category: data.category,
      category_group: data.category_group || null,
      badge_text: data.badge_text || null,
      badge_color: data.badge_color,
      logo_url: data.logo_url || null,
      manual_url: data.manual_url || null,
      // 조달청 등록번호(054) — 지웠을 때도 반영되도록 항상 포함(빈 값·공백만이면 null).
      // ?? '' 방어: 배포 직후 구버전 화면이 열려 있던 탭에서 이 필드가 빠진 채로 호출될 수 있다
      procurement_class_number: (data.procurement_class_number ?? '').trim() || null,
      procurement_item_number: (data.procurement_item_number ?? '').trim() || null,
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

    let { error } = await c.from('products').update(productUpdate).eq('id', id)

    // 054 미적용이면 조달번호 두 키만 빼고 재시도 — 이름·가격 등 무관한 수정까지 막히면 안 된다
    if (error && isMissingColumnError(error)) {
      const stripped = { ...productUpdate }
      delete stripped.procurement_class_number
      delete stripped.procurement_item_number
      ;({ error } = await c.from('products').update(stripped).eq('id', id))
    }

    if (error) {
      // 원문은 영문이라 화면에 내보내지 않는다. 사유는 서버 기록에만 남긴다.
      console.error('[products/edit] 제품 저장 실패:', error.message)
      return { error: '제품을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.' }
    }

    // 활성/비활성 상태가 실제로 바뀐 경우에만 활동 로그 기록(단순 내용 수정은 로그 대상 아님)
    if (initialData.is_active !== data.is_active) {
      await logAdminActivity({
        adminUserId: gate.userId,
        action: 'product.toggle_active',
        targetType: 'product',
        targetId: id,
        detail: { from: initialData.is_active, to: data.is_active },
      })
    }

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
      if (deactivateError) {
        console.error('[products/edit] 옵션 비활성화 실패:', deactivateError.message)
        return { error: '삭제한 옵션을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
      }
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
      if (updateError) {
        console.error('[products/edit] 가격 수정 실패:', updateError.message)
        return { error: '가격 항목을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.' }
      }
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
      if (insertError) {
        console.error('[products/edit] 가격 추가 실패:', insertError.message)
        return { error: '새 가격 항목을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.' }
      }
    }

    // 감사 기록 — 실제로 바뀐 항목만. 짧은 값은 전/후 그대로, 긴 문구는 앞부분+글자 수 요약,
    // 목록형(태그·FAQ 등)은 바뀐 사실과 개수만(전문 금지). is_active는 위 toggle 기록이 담당.
    // 비교 계산 자체가 실패해도 저장은 이미 성공 — try로 감싸 조용히 넘어간다.
    try {
      const SHORT_FIELDS = ['name', 'slug', 'tagline', 'category', 'category_group', 'badge_text', 'badge_color', 'logo_url', 'manual_url', 'hero_image_url', 'version_info_url', 'procurement_class_number', 'procurement_item_number', 'option_axis1_name', 'option_axis2_name'] as const
      const LIST_FIELDS = ['tags', 'pricing_features', 'product_features', 'screenshots', 'faqs'] as const
      const changed: Array<Record<string, unknown>> = []
      for (const f of SHORT_FIELDS) {
        const from = String(initialData[f] ?? '')
        const to = String(data[f] ?? '')
        if (from === to) continue
        changed.push(from.length <= 80 && to.length <= 80
          ? { key: f, from, to }
          : { key: f, from: summarizeForLog(from), to: summarizeForLog(to) })
      }
      // 긴 문구 — description은 실제 저장된 값(sanitize 후) 기준으로 비교한다
      const longPairs: Array<[string, string, string]> = [
        ['description', String(initialData.description ?? ''), String(productUpdate.description ?? '')],
        ['list_description', String(initialData.list_description ?? ''), String(data.list_description ?? '')],
        ['system_requirements', String(initialData.system_requirements ?? ''), String(data.system_requirements ?? '')],
      ]
      for (const [key, from, to] of longPairs) {
        if (from !== to) changed.push({ key, from: summarizeForLog(from), to: summarizeForLog(to) })
      }
      for (const f of LIST_FIELDS) {
        const from = initialData[f] as unknown[]
        const to = data[f] as unknown[]
        if (JSON.stringify(from) !== JSON.stringify(to)) {
          changed.push({ key: f, changed: true, fromCount: from.length, toCount: to.length })
        }
      }
      // 가격(돈 경로)은 행별로 전 속성의 전/후를 남긴다 — 금액만 비교하던 구멍으로 기록이
      // 통째로 누락된 사고(2026-08-15)의 수정. 특히 라이선스 대수 구분(license_tier)은
      // 잘못 바뀌면 1PC 손님이 10PC를 쓰게 되는 값이라 전/후를 반드시 남긴다.
      // type·interval도 저장 대상이므로 함께 감시한다(무엇을 바꿔도 남아야 한다는 원칙).
      const PRICE_ROW_FIELDS = ['price', 'type', 'interval', 'license_tier', 'option_axis1_label', 'option_axis2_label', 'sort_order', 'checkout_url', 'lemon_squeezy_variant_id'] as const
      const beforePriceById = new Map(initialData.prices.filter((p) => p.id).map((p) => [p.id as string, p]))
      const priceChanges: Array<Record<string, unknown>> = []
      // 저장 루프와 같은 조건(id 있고 금액이 빈 값 아님)의 행만 비교 — 저장되지 않은 행은 기록 대상 아님
      for (const p of data.prices.filter((pr) => pr.id && pr.price !== '' && beforePriceById.has(pr.id as string))) {
        const b = beforePriceById.get(p.id as string)!
        const row: Record<string, unknown> = {}
        for (const f of PRICE_ROW_FIELDS) {
          const from = String(b[f] ?? '')
          const to = String(p[f] ?? '')
          if (from === to) continue
          // 금액은 표기 차이(예: "9900"과 "9900.0")가 오탐되지 않도록 숫자로 한 번 더 비교
          if (f === 'price' && from !== '' && to !== '' && parseFloat(from) === parseFloat(to)) continue
          row[f] = from.length <= 80 && to.length <= 80
            ? { from, to }
            : { from: summarizeForLog(from), to: summarizeForLog(to) }
        }
        if (Object.keys(row).length > 0) priceChanges.push({ id: p.id, ...row })
      }

      // 최소 기록 원칙(2026-08-15) — 감지 0건이어도 "누가 언제 이 상품을 저장했다"는 항상 남긴다
      const hasChanges = changed.length > 0 || priceChanges.length > 0 || toDeactivate.length > 0 || newPrices.length > 0
      await logAdminActivity({
        adminUserId: gate.userId,
        action: 'product.update',
        targetType: 'product',
        targetId: id,
        detail: buildChangeDetail(hasChanges, {
          changed,
          priceChanges,
          pricesDeactivated: toDeactivate.length,
          pricesAdded: newPrices.length,
        }),
      })
    } catch (err) {
      // 기록 실패는 저장을 막지 않는다 — 단, 완전 무음이면 원인 추적이 불가능하므로 서버 기록은 남긴다
      console.error('[products/edit] 감사 기록 실패(저장은 성공):', err instanceof Error ? err.message : String(err))
    }

    revalidatePath('/admin/products')
    revalidatePath(`/admin/products/${id}/edit`)
    return {}
  }

  return (
    <PageContainer variant="admin" className="space-y-6">
      <div>
        <Link href="/admin/products" className="text-sm text-ink-faint hover:text-ink-soft transition-colors">
          ← 제품 목록으로
        </Link>
        <h1 className="text-2xl font-bold font-serif text-ink mt-3">제품 편집</h1>
        <p className="text-sm text-ink-soft mt-1">{product.name}</p>
      </div>

      <ProductForm initialData={initialData} onSubmit={updateProduct} submitLabel="변경사항 저장" />

      <ChangelogSection productId={id} initialChangelogs={changelogs} />
    </PageContainer>
  )
}
