/**
 * @파일: app/product/[slug]/page.tsx
 * @설명: 상품 독립 상세 페이지 — slug로 상품을 조회해 상세 콘텐츠를 렌더한다.
 *        대표 이미지·스크린샷 갤러리·상세설명·기능·시스템 요구사항·버전정보 + 가격/CTA.
 *        SEO: generateMetadata로 페이지별 title/description/OG. 없는 콘텐츠는 우아하게 생략.
 *        ⚠️ 결제 slug 로직과 별개의 '표시용' slug 조회. 구매 CTA는 기존 /pricing 흐름으로 연결(결제 로직 미접촉).
 *        마이그레이션 035/036 미적용 시에도 500이 나지 않도록 상세 컬럼은 폴백 조회한다.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import DynamicIcon from '@/components/DynamicIcon'
import { CATEGORY_BADGE_PAPER, CATEGORY_LABELS } from '@/lib/products'
import { formatPrice } from '@/lib/price'
import { getProductOptions } from '@/lib/product-options'
import { resolveCheckoutAffiliateRef } from '@/lib/affiliate'
import ProductOptionSelector from '@/components/ProductOptionSelector'

export const dynamic = 'force-dynamic'

// 상세 콘텐츠 컬럼 포함 select(035/036 적용 후) / 기본 select(폴백)
const FULL_COLS =
  'id, name, slug, tagline, description, category, category_group, logo_url, badge_text, badge_color, is_active, tags, pricing_features, product_features, hero_image_url, screenshots, system_requirements, version_info_url, faqs, product_prices(type, interval, price, is_active)'
const BASE_COLS =
  'id, name, slug, tagline, description, category, logo_url, badge_text, badge_color, is_active, tags, pricing_features, product_features, product_prices(type, interval, price, is_active)'

interface ProductFeature { icon: string; image_url: string; title: string; description: string }
interface PriceRow { type: string; interval: string | null; price: number; is_active: boolean }

/** slug로 상품 1건 조회 — 상세 컬럼 우선, 미적용 시 기본 컬럼 폴백 */
async function getProduct(slug: string) {
  const client = createAdminClient()
  const withRes = await client.from('products').select(FULL_COLS).eq('slug', slug).maybeSingle()
  if (!withRes.error) return withRes.data as Record<string, unknown> | null
  const baseRes = await client.from('products').select(BASE_COLS).eq('slug', slug).maybeSingle()
  return baseRes.data as Record<string, unknown> | null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const client = createAdminClient()
  // 메타데이터는 항상 존재하는 기본 컬럼만 사용(마이그레이션 의존 없음)
  const { data } = await client
    .from('products')
    .select('name, tagline, description, logo_url')
    .eq('slug', slug)
    .maybeSingle()

  if (!data) return { title: '제품을 찾을 수 없습니다' }

  const name = (data.name as string) ?? '제품'
  const desc = (data.tagline as string) || (data.description as string) || `${name} — CoreZent 제품`
  const image = (data.logo_url as string) || undefined

  return {
    title: name,
    description: desc.slice(0, 160),
    openGraph: {
      title: `${name} — CoreZent`,
      description: desc.slice(0, 160),
      ...(image ? { images: [{ url: image }] } : {}),
    },
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  // 옵션 있는 상품이면 상세페이지에서 바로 옵션 선택·구매 (공용 선택기)
  const optClient = createAdminClient()
  const [{ optionRows, axis1Name, axis2Name }, affiliateRef] = await Promise.all([
    getProductOptions(optClient, product.id as string),
    resolveCheckoutAffiliateRef(),
  ])

  const name = product.name as string
  const tagline = product.tagline as string | null
  const description = product.description as string | null
  const category = product.category as string | null
  const categoryGroup = (product.category_group as string | null) ?? null
  const logoUrl = product.logo_url as string | null
  const isActive = (product.is_active as boolean) ?? false
  const tags = (product.tags ?? []) as string[]
  const productFeatures = (product.product_features ?? []) as ProductFeature[]
  const heroImage = (product.hero_image_url as string | null) ?? null
  const screenshots = (product.screenshots ?? []) as string[]
  const systemRequirements = (product.system_requirements as string | null) ?? null
  const versionInfoUrl = (product.version_info_url as string | null) ?? null

  const prices = ((product.product_prices ?? []) as PriceRow[]).filter((p) => p.is_active)
  const monthly = prices.find((p) => p.type === 'subscription' && p.interval === 'monthly')
  const annual = prices.find((p) => p.type === 'subscription' && p.interval === 'annual')
  const oneTime = prices.find((p) => p.type === 'one_time')
  const priceValue = monthly?.price ?? oneTime?.price ?? null

  const pricingFeatures = (product.pricing_features ?? []) as string[]
  const faqs = (product.faqs ?? []) as { question: string; answer: string }[]

  // 요금제 비교표용 플랜 목록(있는 것만)
  const plans: { label: string; price: number; suffix: string }[] = []
  if (monthly) plans.push({ label: '월간', price: monthly.price, suffix: '/월' })
  if (annual) plans.push({ label: '연간', price: annual.price, suffix: '/년' })
  if (oneTime) plans.push({ label: '일회 구매', price: oneTime.price, suffix: '' })

  return (
    <>
      <Navbar />
      <main className="theme-paper min-h-screen bg-paper text-ink">
        <section className="relative pt-10 sm:pt-14 pb-24 px-4 sm:px-6">
          <div className="relative z-10 max-w-5xl mx-auto">
            {/* 뒤로 */}
            <Link href="/product" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink transition-colors mb-8">
              <ArrowLeft size={14} /> 제품 목록
            </Link>

            {/* 헤더 */}
            <div className="flex items-start gap-5 mb-8">
              {logoUrl && (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-rule bg-paper-raised">
                  <Image src={logoUrl} alt={`${name} logo`} fill className="object-contain p-2" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-3xl font-serif font-black text-ink">{name}</h1>
                  {category && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_BADGE_PAPER[category] ?? 'bg-paper-shade text-ink-soft border-rule'}`}>
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                  )}
                  {categoryGroup && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-paper-shade text-ink-soft border-rule">
                      {categoryGroup}
                    </span>
                  )}
                </div>
                {tagline && <p className="text-pen text-base font-medium">{tagline}</p>}
              </div>
            </div>

            {/* 대표 이미지 */}
            {heroImage && (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-rule bg-paper-raised mb-10">
                <Image src={heroImage} alt={`${name} 대표 이미지`} fill className="object-cover" />
              </div>
            )}

            {/* 가격 + CTA — 옵션 있는 상품은 옵션 선택기, 아니면 단일 가격 + 요금제 링크 */}
            {optionRows.length > 0 && isActive ? (
              <div className="mb-10">
                <ProductOptionSelector
                  productName={name}
                  axis1Name={axis1Name}
                  axis2Name={axis2Name}
                  optionRows={optionRows}
                  affiliateRef={affiliateRef}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4 mb-10">
                {priceValue != null && (
                  <div>
                    <span className="text-3xl font-bold text-ink">{formatPrice(priceValue)}</span>
                    {monthly && <span className="text-sm text-ink-soft font-normal">/월</span>}
                    <span className="text-xs text-ink-faint ml-2">
                      VAT 포함{annual != null ? ` · 또는 ${formatPrice(annual.price)}/년` : ''}
                    </span>
                  </div>
                )}
                {isActive ? (
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center gap-2 bg-pen text-white font-semibold px-6 py-3 rounded-md text-sm hover:bg-pen-dark transition-colors"
                  >
                    구매하기 →
                  </Link>
                ) : (
                  <span className="inline-flex items-center justify-center gap-2 border border-dashed border-rule text-ink-faint font-medium px-6 py-3 rounded-md text-sm">
                    출시 예정
                  </span>
                )}
              </div>
            )}

            {/* 태그 */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-10">
                {tags.map((tag) => (
                  <span key={tag} className="text-xs text-ink-soft border border-rule rounded-full px-3 py-1">{tag}</span>
                ))}
              </div>
            )}

            {/* 상세 설명 */}
            {description && (
              <div className="mb-12">
                <h2 className="text-lg font-serif font-black text-ink mb-3">소개</h2>
                <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-line">{description}</p>
              </div>
            )}

            {/* 스크린샷 갤러리 */}
            {screenshots.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-serif font-black text-ink mb-4">스크린샷</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {screenshots.map((src, i) => (
                    <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-rule bg-paper-raised">
                      <Image src={src} alt={`${name} 스크린샷 ${i + 1}`} fill className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 주요 기능 */}
            {productFeatures.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-serif font-black text-ink mb-4">주요 기능</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {productFeatures.map((feat, i) => (
                    <div key={i} className="border border-rule bg-paper-raised rounded-lg p-5 flex flex-col items-center text-center space-y-3">
                      <div className="flex items-center justify-center w-[72px] h-[72px] rounded-lg bg-paper-shade border border-rule">
                        {feat.image_url ? (
                          <div className="relative w-12 h-12"><Image src={feat.image_url} alt={feat.title} fill className="object-contain" /></div>
                        ) : feat.icon ? (
                          <DynamicIcon name={feat.icon} size={30} className="text-pen" />
                        ) : (
                          <Sparkles size={30} className="text-pen" />
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-ink">{feat.title}</h3>
                      {feat.description && <p className="text-xs text-ink-soft leading-relaxed whitespace-pre-line">{feat.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 요금제 비교 */}
            {plans.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-serif font-black text-ink mb-4">요금제</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-rule rounded-lg overflow-hidden">
                    <thead>
                      <tr className="border-b border-rule bg-paper-shade">
                        <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">항목</th>
                        {plans.map((p) => (
                          <th key={p.label} className="text-center px-4 py-3 text-xs text-ink font-semibold">{p.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-rule/60">
                        <td className="px-4 py-3 text-ink-soft">가격</td>
                        {plans.map((p) => (
                          <td key={p.label} className="text-center px-4 py-3 text-ink font-semibold tabular-nums">
                            {formatPrice(p.price)}<span className="text-xs text-ink-faint font-normal">{p.suffix}</span>
                          </td>
                        ))}
                      </tr>
                      {pricingFeatures.map((feat) => (
                        <tr key={feat} className="border-b border-rule/60 last:border-0">
                          <td className="px-4 py-3 text-ink-soft">{feat}</td>
                          {plans.map((p) => (
                            <td key={p.label} className="text-center px-4 py-3">
                              <Check size={15} className="text-emerald-600 inline" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pricingFeatures.length > 0 && plans.length > 1 && (
                  <p className="text-xs text-ink-faint mt-2">모든 요금제에 동일 기능이 포함됩니다. 결제 주기만 다릅니다.</p>
                )}
              </div>
            )}

            {/* 시스템 요구사항 */}
            {systemRequirements && (
              <div className="mb-12">
                <h2 className="text-lg font-serif font-black text-ink mb-3">시스템 요구사항</h2>
                <div className="border border-rule bg-paper-raised rounded-lg p-5">
                  <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-line">{systemRequirements}</p>
                </div>
              </div>
            )}

            {/* FAQ */}
            {faqs.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-serif font-black text-ink mb-4">자주 묻는 질문</h2>
                <div className="space-y-3">
                  {faqs.map((faq, i) => (
                    <div key={i} className="border border-rule bg-paper-raised rounded-lg p-5">
                      <p className="text-ink font-medium mb-2">{faq.question}</p>
                      {faq.answer && <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-line">{faq.answer}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 버전정보 링크 */}
            {versionInfoUrl && (
              <div className="mb-4">
                <Link href={versionInfoUrl} className="inline-flex items-center gap-1.5 text-sm text-pen hover:text-pen-dark hover:underline">
                  <Check size={14} /> 버전 정보 및 업데이트 내역
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
