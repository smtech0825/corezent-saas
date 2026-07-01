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
import { CATEGORY_BADGE, CATEGORY_LABELS } from '@/lib/products'
import { formatPrice } from '@/lib/price'

export const dynamic = 'force-dynamic'

// 상세 콘텐츠 컬럼 포함 select(035/036 적용 후) / 기본 select(폴백)
const FULL_COLS =
  'id, name, slug, tagline, description, category, category_group, logo_url, badge_text, badge_color, is_active, tags, product_features, hero_image_url, screenshots, system_requirements, version_info_url, product_prices(type, interval, price, is_active)'
const BASE_COLS =
  'id, name, slug, tagline, description, category, logo_url, badge_text, badge_color, is_active, tags, product_features, product_prices(type, interval, price, is_active)'

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

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0B1120]">
        <section className="relative pt-32 pb-24 px-6">
          <div className="relative z-10 max-w-5xl mx-auto">
            {/* 뒤로 */}
            <Link href="/product" className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#94A3B8] transition-colors mb-8">
              <ArrowLeft size={14} /> 제품 목록
            </Link>

            {/* 헤더 */}
            <div className="flex items-start gap-5 mb-8">
              {logoUrl && (
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-[#1E293B] bg-[#111A2E]">
                  <Image src={logoUrl} alt={`${name} logo`} fill className="object-contain p-2" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-3xl font-bold text-white">{name}</h1>
                  {category && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_BADGE[category] ?? 'bg-[#1E293B] text-[#94A3B8] border-[#1E293B]'}`}>
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                  )}
                  {categoryGroup && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-[#1E293B] text-[#94A3B8] border-[#1E293B]">
                      {categoryGroup}
                    </span>
                  )}
                </div>
                {tagline && <p className="text-[#38BDF8] text-base font-medium">{tagline}</p>}
              </div>
            </div>

            {/* 대표 이미지 */}
            {heroImage && (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-[#1E293B] bg-[#111A2E] mb-10">
                <Image src={heroImage} alt={`${name} 대표 이미지`} fill className="object-cover" />
              </div>
            )}

            {/* 가격 + CTA */}
            <div className="flex flex-wrap items-center gap-4 mb-10">
              {priceValue != null && (
                <div>
                  <span className="text-3xl font-bold text-white">{formatPrice(priceValue)}</span>
                  {monthly && <span className="text-sm text-[#94A3B8] font-normal">/월</span>}
                  <span className="text-xs text-[#475569] ml-2">
                    VAT 포함{annual != null ? ` · 또는 ${formatPrice(annual.price)}/년` : ''}
                  </span>
                </div>
              )}
              {isActive ? (
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold px-6 py-3 rounded-xl text-sm hover:bg-[#0ea5e9] transition-colors"
                >
                  구매하기 →
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center gap-2 border border-[#1E293B] text-[#475569] font-medium px-6 py-3 rounded-xl text-sm">
                  출시 예정
                </span>
              )}
            </div>

            {/* 태그 */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-10">
                {tags.map((tag) => (
                  <span key={tag} className="text-xs text-[#94A3B8] border border-[#1E293B] rounded-full px-3 py-1">{tag}</span>
                ))}
              </div>
            )}

            {/* 상세 설명 */}
            {description && (
              <div className="mb-12">
                <h2 className="text-lg font-bold text-white mb-3">소개</h2>
                <p className="text-[#94A3B8] text-sm leading-relaxed whitespace-pre-line">{description}</p>
              </div>
            )}

            {/* 스크린샷 갤러리 */}
            {screenshots.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-bold text-white mb-4">스크린샷</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {screenshots.map((src, i) => (
                    <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-[#1E293B] bg-[#111A2E]">
                      <Image src={src} alt={`${name} 스크린샷 ${i + 1}`} fill className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 주요 기능 */}
            {productFeatures.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-bold text-white mb-4">주요 기능</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {productFeatures.map((feat, i) => (
                    <div key={i} className="border border-[#1E293B] bg-[#111A2E] rounded-xl p-5 flex flex-col items-center text-center space-y-3">
                      <div className="flex items-center justify-center w-[72px] h-[72px] rounded-xl bg-[#0B1120] border border-[#1E293B]">
                        {feat.image_url ? (
                          <div className="relative w-12 h-12"><Image src={feat.image_url} alt={feat.title} fill className="object-contain" /></div>
                        ) : feat.icon ? (
                          <DynamicIcon name={feat.icon} size={30} className="text-[#38BDF8]" />
                        ) : (
                          <Sparkles size={30} className="text-[#38BDF8]" />
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white">{feat.title}</h3>
                      {feat.description && <p className="text-xs text-[#94A3B8] leading-relaxed whitespace-pre-line">{feat.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 시스템 요구사항 */}
            {systemRequirements && (
              <div className="mb-12">
                <h2 className="text-lg font-bold text-white mb-3">시스템 요구사항</h2>
                <div className="border border-[#1E293B] bg-[#111A2E] rounded-xl p-5">
                  <p className="text-[#94A3B8] text-sm leading-relaxed whitespace-pre-line">{systemRequirements}</p>
                </div>
              </div>
            )}

            {/* 버전정보 링크 */}
            {versionInfoUrl && (
              <div className="mb-4">
                <Link href={versionInfoUrl} className="inline-flex items-center gap-1.5 text-sm text-[#38BDF8] hover:underline">
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
