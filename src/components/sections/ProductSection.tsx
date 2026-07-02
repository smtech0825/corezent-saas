/**
 * @컴포넌트: ProductSection
 * @설명: 랜딩 제품 목록 섹션 (페이퍼 테마) — DB 상품을 흰 종이 카드 그리드로 표시.
 *        Admin에서 등록한 상품이 자동으로 반영됨. 데이터 로직은 기존과 동일.
 */

import Link from 'next/link'
import { Clock } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORY_BADGE_PAPER, CATEGORY_LABELS, PRODUCT_BADGE_COLORS_PAPER } from '@/lib/products'
import { formatPrice } from '@/lib/price'
import Section, { SectionHeader } from '@/components/ui/Section'
import Button from '@/components/ui/Button'

interface ProductCard {
  name: string
  slug: string | null
  tagline: string
  description: string
  category: string
  categoryGroup: string | null
  tags: string[]
  badgeText: string | null
  badgeColor: string
  monthlyPrice: string | null
  annualPrice: string | null
  href: string
  available: boolean
}

// Coming Soon 플레이스홀더
const COMING_SOON: ProductCard[] = [
  {
    name: '출시 예정',
    tagline: '새로운 제품 개발 중',
    description:
      '다음 소프트웨어 제품을 준비하고 있습니다. 출시 소식을 가장 먼저 받아보시려면 가입하세요.',
    category: '',
    categoryGroup: null,
    slug: null,
    tags: [],
    badgeText: null,
    badgeColor: 'blue',
    monthlyPrice: null,
    annualPrice: null,
    href: '/auth/register',
    available: false,
  },
  {
    name: '출시 예정',
    tagline: '더 많은 도구가 준비 중',
    description:
      'CoreZent는 제품 라인업을 꾸준히 확장하고 있습니다. 더 강력한 소프트웨어 도구를 기대해 주세요.',
    category: '',
    categoryGroup: null,
    slug: null,
    tags: [],
    badgeText: null,
    badgeColor: 'blue',
    monthlyPrice: null,
    annualPrice: null,
    href: '/auth/register',
    available: false,
  },
]

export default async function ProductSection() {
  const client = createAdminClient()

  // 모든 상품 + 활성 가격 조회 (category·slug 포함)
  // category_group(마이그레이션 035) 우선 조회 → 미적용 시 폴백(랜딩 목록은 정상, 카테고리만 비활성)
  const BASE = 'name, slug, tagline, description, category, tags, badge_text, badge_color, is_active, order_index, product_prices(type, interval, price, is_active)'
  const withRes = await client
    .from('products')
    .select('name, slug, tagline, description, category, category_group, tags, badge_text, badge_color, is_active, order_index, product_prices(type, interval, price, is_active)')
    .eq('is_active', true)
    .order('order_index', { ascending: true })
  const { data: rawProducts } = withRes.error
    ? await client.from('products').select(BASE).eq('is_active', true).order('order_index', { ascending: true })
    : withRes

  // DB 상품 → 카드 데이터 변환
  const dbCards: ProductCard[] = (rawProducts ?? []).map((p) => {
    const prices = ((p.product_prices ?? []) as Array<{ type: string; interval: string | null; price: number; is_active: boolean }>)
      .filter((pr) => pr.is_active)
    const monthly = prices.find((pr) => pr.type === 'subscription' && pr.interval === 'monthly')
    const annual = prices.find((pr) => pr.type === 'subscription' && pr.interval === 'annual')

    return {
      name: p.name as string,
      slug: (p.slug as string) ?? null,
      tagline: (p.tagline as string) ?? '',
      description: (p.description as string) ?? '',
      category: (p.category as string) ?? '',
      categoryGroup: ((p as { category_group?: string | null }).category_group) ?? null,
      tags: ((p.tags ?? []) as string[]),
      badgeText: (p.badge_text as string) ?? null,
      badgeColor: (p.badge_color as string) ?? 'blue',
      monthlyPrice: monthly ? formatPrice(monthly.price) : null,
      annualPrice: annual ? formatPrice(annual.price) : null,
      href: '/pricing',
      available: true,
    }
  })

  // 활성 상품 + Coming Soon 플레이스홀더로 최소 3개 채우기
  const neededPlaceholders = Math.max(0, 3 - dbCards.length)
  const products = [...dbCards, ...COMING_SOON.slice(0, neededPlaceholders)]

  return (
    <Section id="product" width="wide">
      <SectionHeader
        label="제품 소개"
        title="나를 위해 일하는 소프트웨어"
        sub="우리가 만드는 모든 제품은 첫날부터 시간을 아끼고, 번거로움을 줄이고, 실질적인 결과를 전하도록 설계되었습니다."
      />

      {/* 제품 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {products.map((product, idx) => (
          <div
            key={idx}
            className={`flex flex-col rounded-lg p-7 transition-all duration-200 ${
              product.available
                ? 'border border-rule bg-paper-raised shadow-[0_1px_2px_rgba(35,39,46,0.05)] hover:border-ink-faint hover:shadow-[0_6px_20px_rgba(35,39,46,0.08)]'
                : 'border-[1.5px] border-dashed border-rule bg-transparent'
            }`}
          >
            <div className="flex flex-col flex-1">
              {/* 뱃지 — DB badge_text 우선 */}
              {(() => {
                const text = product.badgeText ?? (product.available ? null : '출시 예정')
                if (!text) return null
                const colorCls = product.available
                  ? (PRODUCT_BADGE_COLORS_PAPER[product.badgeColor] ?? PRODUCT_BADGE_COLORS_PAPER.blue)
                  : 'text-ink-faint bg-paper-shade border-rule'
                return (
                  <div className={`inline-flex items-center gap-1.5 self-start border rounded px-2.5 py-1 text-xs font-semibold mb-5 ${colorCls}`}>
                    {!product.available && <Clock size={11} />}
                    {text}
                  </div>
                )
              })()}

              {/* 이름 + 카테고리 뱃지 */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-serif text-xl font-black text-ink">{product.name}</h3>
                {product.category && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${CATEGORY_BADGE_PAPER[product.category] ?? 'bg-paper-shade text-ink-soft border-rule'}`}>
                    {CATEGORY_LABELS[product.category] ?? product.category}
                  </span>
                )}
                {product.categoryGroup && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded border bg-paper-shade text-ink-soft border-rule">
                    {product.categoryGroup}
                  </span>
                )}
              </div>
              <p className="text-pen text-sm font-medium mb-4">{product.tagline}</p>

              {/* 설명 — 3줄 클램프 + 더보기 → /product 이동 */}
              {product.description && (
                <div className="relative mb-4">
                  <p className="text-ink-soft text-sm leading-relaxed line-clamp-3 break-keep">
                    {product.description}
                  </p>
                  {product.available && product.description.length > 120 && (
                    <Link
                      href={product.slug ? `/product/${product.slug}` : '/product'}
                      className="absolute bottom-0 right-0 text-pen hover:text-pen-dark transition-colors font-medium text-sm"
                      style={{ background: 'linear-gradient(to right, transparent, #FFFFFF 30%)', paddingLeft: '1.5rem' }}
                    >
                      더보기
                    </Link>
                  )}
                </div>
              )}

              {/* 태그 */}
              {product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs border border-rule text-ink-faint rounded px-2.5 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 가격 + CTA */}
              {product.available ? (
                <div className="mt-auto">
                  {product.monthlyPrice && (
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl font-bold text-ink font-serif">
                        {product.monthlyPrice}
                        <span className="text-sm text-ink-soft font-sans font-normal">/월</span>
                      </span>
                      <span className="text-xs text-ink-faint">
                        VAT 포함{product.annualPrice ? ` · 또는 ${product.annualPrice}/년` : ''}
                      </span>
                    </div>
                  )}
                  <Button href={product.href} size="md" className="w-full">
                    시작하기
                  </Button>
                </div>
              ) : (
                <div className="mt-auto">
                  <span className="w-full inline-flex items-center justify-center gap-2 border border-rule text-ink-faint font-medium py-2.5 rounded-md text-sm cursor-not-allowed">
                    출시 알림 받기
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
