/**
 * @파일: app/product/[slug]/page.tsx
 * @설명: 상품 독립 상세 페이지 — slug로 상품을 조회해 상세 콘텐츠를 렌더한다.
 *        대표 이미지·스크린샷 갤러리·상세설명·기능·시스템 요구사항·버전정보를 섹션별 보더 컨테이너로 묶고,
 *        구매 컨트롤(옵션·수량·가격·구매)은 하단 고정 플로팅 바(ProductBuyBar)로 제공한다.
 *        SEO: generateMetadata로 페이지별 title/description/OG. 없는 콘텐츠는 우아하게 생략.
 *        ⚠️ 결제 slug 로직과 별개의 '표시용' slug 조회. 구매 링크는 buildCheckoutUrl(미접촉)로 생성.
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
import { getProductOptions, type OptionRow } from '@/lib/product-options'
import { resolveCheckoutAffiliateRef } from '@/lib/affiliate'
import ProductBuyBar from './ProductBuyBar'
import RichContent from '@/components/common/RichContent'

export const dynamic = 'force-dynamic'

// 상세 콘텐츠 컬럼 포함 select(035/036 적용 후) / 기본 select(폴백). checkout_url은 항상 존재하는 기본 컬럼.
const FULL_COLS =
  'id, name, slug, tagline, description, category, category_group, logo_url, badge_text, badge_color, is_active, tags, pricing_features, product_features, hero_image_url, screenshots, system_requirements, version_info_url, faqs, product_prices(id, type, interval, price, is_active, checkout_url)'
const BASE_COLS =
  'id, name, slug, tagline, description, category, logo_url, badge_text, badge_color, is_active, tags, pricing_features, product_features, product_prices(id, type, interval, price, is_active, checkout_url)'

interface ProductFeature { icon: string; image_url: string; title: string; description: string }
interface PriceRow { id: string; type: string; interval: string | null; price: number; is_active: boolean; checkout_url: string | null }

// 섹션 컨테이너 공통 스타일 — 각 섹션을 통일된 카드 박스로 묶는다.
const SECTION_BOX = 'border border-rule rounded-lg bg-paper-raised p-6 sm:p-8'
const SECTION_TITLE = 'text-lg font-serif font-black text-ink mb-4'

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

  // 옵션 있는 상품이면 하단 바에서 바로 옵션 선택·구매 (공용 조회기)
  const optClient = createAdminClient()
  const [{ optionRows, axis1Name, axis2Name }, affiliateRef, bankRes] = await Promise.all([
    getProductOptions(optClient, product.id as string),
    resolveCheckoutAffiliateRef(),
    optClient.from('front_settings').select('key, value')
      .in('key', ['bank_transfer_enabled', 'bank_transfer_bank', 'bank_transfer_account_number', 'bank_transfer_account_holder']),
  ])

  // 계좌이체 안내(front_settings) — 활성 + 계좌번호가 있을 때만 결제방법으로 노출
  const bankMap = new Map((bankRes.data ?? []).map((r) => [r.key, r.value ?? '']))
  const bankTransfer = {
    enabled: bankMap.get('bank_transfer_enabled') === 'true' && !!(bankMap.get('bank_transfer_account_number') ?? '').trim(),
    bank: bankMap.get('bank_transfer_bank') ?? '',
    accountNumber: bankMap.get('bank_transfer_account_number') ?? '',
    accountHolder: bankMap.get('bank_transfer_account_holder') ?? '',
  }

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

  const pricingFeatures = (product.pricing_features ?? []) as string[]
  const faqs = (product.faqs ?? []) as { question: string; answer: string }[]

  // 요금제 카드용 플랜 목록(있는 것만)
  const plans: { label: string; price: number; suffix: string }[] = []
  if (monthly) plans.push({ label: '월간', price: monthly.price, suffix: '/월' })
  if (annual) plans.push({ label: '연간', price: annual.price, suffix: '/년' })
  if (oneTime) plans.push({ label: '일회 구매', price: oneTime.price, suffix: '' })

  const hasOptions = optionRows.length > 0
  // 연간 절약률 — 월간 대비 (연 총액/12)
  const annualSavePct = monthly && annual ? Math.round((1 - annual.price / 12 / monthly.price) * 100) : 0
  // 요금제 섹션: 비-옵션 상품의 가격 카드 or 포함 기능 리스트 중 하나라도 있을 때 렌더
  const showPlanCards = !hasOptions && plans.length > 0
  const showPricingSection = showPlanCards || pricingFeatures.length > 0

  // 하단 구매 바에 넘길 옵션 행을 정규화한다.
  //  · 옵션 상품: getProductOptions 결과 그대로(축1·축2)
  //  · 비옵션 상품: 월/연/일회 가격을 '기간' 축의 옵션으로 합성 → 컨트롤은 2개 이상일 때만 노출
  let buyRows: OptionRow[]
  let barAxis1Name: string | null
  let barAxis2Name: string | null
  if (hasOptions) {
    buyRows = optionRows
    barAxis1Name = axis1Name
    barAxis2Name = axis2Name
  } else {
    buyRows = []
    if (monthly) buyRows.push({ priceId: monthly.id, axis1Label: '월간', axis2Label: null, price: monthly.price, checkoutUrl: monthly.checkout_url ?? '#', suffix: '/월' })
    if (annual) buyRows.push({ priceId: annual.id, axis1Label: '연간', axis2Label: null, price: annual.price, checkoutUrl: annual.checkout_url ?? '#', suffix: '/년' })
    if (oneTime) buyRows.push({ priceId: oneTime.id, axis1Label: '일회 구매', axis2Label: null, price: oneTime.price, checkoutUrl: oneTime.checkout_url ?? '#', suffix: '' })
    barAxis1Name = buyRows.length > 1 ? '기간' : null
    barAxis2Name = null
  }
  const hasBar = buyRows.length > 0

  return (
    <>
      <Navbar />
      {/* 하단 고정 바 높이만큼 여백 — 푸터·본문이 바에 가리지 않게(측정값 --buy-bar-h, 미측정 시 88px) */}
      <div style={hasBar ? { paddingBottom: 'var(--buy-bar-h, 88px)' } : undefined}>
        <main className="theme-paper min-h-screen bg-paper text-ink">
          <section className="relative pt-10 sm:pt-14 pb-16 px-4 sm:px-6">
            <div className="relative z-10 max-w-4xl mx-auto">
              {/* 뒤로 */}
              <Link href="/product" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink transition-colors mb-8">
                <ArrowLeft size={14} /> 제품 목록
              </Link>

              {/* 헤더 (박스 밖) — 로고·이름·태그라인·태그. 구매/가격은 하단 바가 대체 */}
              <div className="flex items-start gap-5 mb-6">
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

              {/* 태그 (박스 밖) */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {tags.map((tag) => (
                    <span key={tag} className="text-xs text-ink-soft border border-rule rounded-full px-3 py-1">{tag}</span>
                  ))}
                </div>
              )}

              {/* 대표 이미지 (박스 밖) */}
              {heroImage && (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-rule bg-paper-raised mb-8">
                  <Image src={heroImage} alt={`${name} 대표 이미지`} fill className="object-cover" />
                </div>
              )}

              {/* 섹션 컨테이너 스택 — 각 섹션을 보더 카드로 묶는다(빈 데이터는 박스째 미렌더) */}
              <div className="space-y-6">
                {/* 소개 — 마크다운, 본문 가독 폭 68ch */}
                {description && (
                  <section className={SECTION_BOX}>
                    <h2 className={SECTION_TITLE}>소개</h2>
                    <RichContent content={description} className="max-w-[68ch]" />
                  </section>
                )}

                {/* 스크린샷 갤러리 */}
                {screenshots.length > 0 && (
                  <section className={SECTION_BOX}>
                    <h2 className={SECTION_TITLE}>스크린샷</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {screenshots.map((src, i) => (
                        <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-rule bg-paper">
                          <Image src={src} alt={`${name} 스크린샷 ${i + 1}`} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 주요 기능 */}
                {productFeatures.length > 0 && (
                  <section className={SECTION_BOX}>
                    <h2 className={SECTION_TITLE}>주요 기능</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {productFeatures.map((feat, i) => (
                        <div key={i} className="border border-rule bg-paper rounded-lg p-5 flex flex-col items-center text-center space-y-3">
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
                  </section>
                )}

                {/* 요금제 — 비-옵션은 월/연 2 카드, 포함 기능은 단일 리스트 */}
                {showPricingSection && (
                  <section className={SECTION_BOX}>
                    <h2 className={SECTION_TITLE}>{showPlanCards ? '요금제' : '포함 기능'}</h2>
                    {showPlanCards && (
                      <div className="grid gap-4 sm:grid-cols-2 mb-6">
                        {plans.map((plan) => {
                          const isAnnual = plan.label === '연간'
                          return (
                            <div key={plan.label} className="border border-rule bg-paper rounded-lg p-5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-ink">{plan.label}</span>
                                {isAnnual && annualSavePct > 0 && (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                    {annualSavePct}% 절약
                                  </span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-ink tabular-nums">{formatPrice(plan.price)}</span>
                                {plan.suffix && <span className="text-sm text-ink-soft">{plan.suffix}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {pricingFeatures.length > 0 && (
                      <ul className="space-y-2.5 max-w-[68ch]">
                        {pricingFeatures.map((feature) => {
                          const colonIdx = feature.indexOf(':')
                          const [title, desc] = colonIdx !== -1
                            ? [feature.slice(0, colonIdx).trim(), feature.slice(colonIdx + 1).trim()]
                            : [feature, null]
                          return (
                            <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-soft leading-relaxed">
                              <Check size={15} className="text-pen mt-0.5 shrink-0" />
                              <span>{desc ? (<><strong className="text-ink">{title}:</strong> {desc}</>) : title}</span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                )}

                {/* 시스템 요구사항 — 컨테이너가 곧 박스(중첩 박스 없음) */}
                {systemRequirements && (
                  <section className={SECTION_BOX}>
                    <h2 className={SECTION_TITLE}>시스템 요구사항</h2>
                    <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-line max-w-[68ch]">{systemRequirements}</p>
                  </section>
                )}

                {/* 상품 FAQ */}
                {faqs.length > 0 && (
                  <section className={SECTION_BOX}>
                    <h2 className={SECTION_TITLE}>자주 묻는 질문</h2>
                    <div className="space-y-3">
                      {faqs.map((faq, i) => (
                        <div key={i} className="border border-rule bg-paper rounded-lg p-5">
                          <p className="text-ink font-medium mb-2">{faq.question}</p>
                          {faq.answer && <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-line">{faq.answer}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 버전 정보 링크 */}
                {versionInfoUrl && (
                  <section className={SECTION_BOX}>
                    <h2 className={SECTION_TITLE}>버전 정보</h2>
                    <Link href={versionInfoUrl} className="inline-flex items-center gap-1.5 text-sm text-pen hover:text-pen-dark hover:underline">
                      <Check size={14} /> 버전 정보 및 업데이트 내역
                    </Link>
                  </section>
                )}
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>

      {/* 하단 고정 구매 바 — 가격 정보가 하나라도 있을 때만 */}
      {hasBar && (
        <ProductBuyBar
          productName={name}
          isActive={isActive}
          affiliateRef={affiliateRef}
          axis1Name={barAxis1Name}
          axis2Name={barAxis2Name}
          optionRows={buyRows}
          bankTransfer={bankTransfer}
        />
      )}
    </>
  )
}
