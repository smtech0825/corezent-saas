/**
 * @파일: app/buy/[slug]/page.tsx
 * @설명: 옵션 선택·구매 전용 페이지 — 요금제(/pricing) 카드에서 "옵션 선택하기"로 진입한다.
 *        상품 헤더(이름·카테고리 배지·태그라인) + 공용 옵션 선택기(주기·PC수 등) + 구매 버튼.
 *        결제 로직 미접촉 — 선택 조합의 checkout_url로 연결하는 표시 계층.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { CATEGORY_BADGE_PAPER, CATEGORY_LABELS } from '@/lib/products'
import { getProductOptions } from '@/lib/product-options'
import { resolveCheckoutAffiliateRef } from '@/lib/affiliate'
import ProductOptionSelector from '@/components/ProductOptionSelector'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const client = createAdminClient()
  const { data } = await client.from('products').select('name, tagline').eq('slug', slug).maybeSingle()
  if (!data) return { title: '제품을 찾을 수 없습니다' }
  const name = (data.name as string) ?? '제품'
  return {
    title: `${name} 옵션 선택`,
    description: ((data.tagline as string) || `${name} 옵션을 선택하고 구매하세요.`).slice(0, 160),
  }
}

export default async function BuyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const client = createAdminClient()

  const { data: product } = await client
    .from('products')
    .select('id, name, slug, tagline, category, is_active, pricing_features')
    .eq('slug', slug)
    .maybeSingle()
  if (!product) notFound()

  const [{ optionRows, axis1Name, axis2Name }, affiliateRef] = await Promise.all([
    getProductOptions(client, product.id as string),
    resolveCheckoutAffiliateRef(),
  ])

  const category = product.category as string | null
  const pricingFeatures = ((product.pricing_features ?? []) as string[]).filter(Boolean)

  // 옵션 선택기는 기능 유무와 무관하게 동일하므로 한 번만 정의해 두 레이아웃에서 재사용한다.
  const selector = (
    <ProductOptionSelector
      productName={product.name as string}
      axis1Name={axis1Name}
      axis2Name={axis2Name}
      optionRows={optionRows}
      affiliateRef={affiliateRef}
    />
  )

  return (
    <>
      <Navbar />
      <main className="theme-paper min-h-screen bg-paper text-ink">
        <section className="pt-10 sm:pt-14 pb-24 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            {/* 뒤로 */}
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink transition-colors mb-8">
              <ArrowLeft size={14} /> 요금제
            </Link>

            {/* 헤더 */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="text-3xl font-serif font-black text-ink">{product.name as string}</h1>
              {category && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_BADGE_PAPER[category] ?? 'bg-paper-shade text-ink-soft border-rule'}`}>
                  {CATEGORY_LABELS[category] ?? category}
                </span>
              )}
            </div>
            {product.tagline != null && (
              <p className="text-ink-soft text-base mb-8">{product.tagline as string}</p>
            )}

            {optionRows.length > 0 && product.is_active ? (
              pricingFeatures.length > 0 ? (
                /* 기능 요약이 있을 때만 2컬럼 — 없으면 빈 좌측 컬럼을 두지 않는다 */
                <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
                  <ul className="space-y-3 order-2 md:order-1">
                    {pricingFeatures.map((feature) => {
                      const colonIdx = feature.indexOf(':')
                      const [title, desc] = colonIdx !== -1
                        ? [feature.slice(0, colonIdx).trim(), feature.slice(colonIdx + 1).trim()]
                        : [feature, null]
                      return (
                        <li key={feature} className="text-sm text-ink-soft leading-relaxed">
                          {desc ? (<><strong className="text-ink">{title}:</strong> {desc}</>) : title}
                        </li>
                      )
                    })}
                  </ul>
                  <div className="order-1 md:order-2">{selector}</div>
                </div>
              ) : (
                /* 기능 요약이 없으면 옵션 선택기만 단독 배치 */
                <div className="max-w-sm">{selector}</div>
              )
            ) : !product.is_active ? (
              <p className="text-ink-soft">이 상품은 아직 출시 예정입니다.</p>
            ) : (
              <p className="text-ink-soft">
                이 상품은 선택할 옵션이 없습니다.{' '}
                <Link href="/pricing" className="text-pen underline">요금제에서 구매하기 →</Link>
              </p>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
