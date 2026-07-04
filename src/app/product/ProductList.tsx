'use client'

/**
 * @컴포넌트: ProductList
 * @설명: /product 페이지의 상품 카드 목록
 *        - 목록 전용 짧은 소개(list_description)를 3줄 클램프로 표시 + 길면 "더보기"(상세 페이지 링크)
 *        - "자세히 보기" 버튼으로 상세 페이지(/product/[slug]) 이동
 *        ⚠️ 상세 소개 description(리치 HTML)은 목록에 노출하지 않는다(평문화 노출 버그 원인)
 */

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, Clock, Eye } from 'lucide-react'
import { CATEGORY_BADGE_PAPER, CATEGORY_LABELS, PRODUCT_BADGE_COLORS_PAPER } from '@/lib/products'
import { formatPrice } from '@/lib/price'

const DESC_CHAR_LIMIT = 150

interface ProductFeature {
  icon: string
  image_url: string
  title: string
  description: string
}

interface Product {
  id: string
  name: string
  slug: string
  tagline: string | null
  // 목록 전용 짧은 소개(plain text) — 상세 description(리치 HTML)은 목록에 쓰지 않는다
  list_description: string
  category: string
  category_group: string | null
  features: string[]
  tags: string[]
  product_features: ProductFeature[]
  logo_url: string | null
  badgeText: string | null
  badgeColor: string
  is_active: boolean
  monthlyPrice: number | null
  annualPrice: number | null
}

interface Props {
  products: Product[]
}


export default function ProductList({ products }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')

  // 자유입력 카테고리(category_group) 목록 — DB 값 기준(하드코딩 아님)
  const categories = [...new Set(
    products.map((p) => p.category_group?.trim()).filter((c): c is string => !!c),
  )]
  const visibleProducts =
    activeCategory === 'all'
      ? products
      : products.filter((p) => (p.category_group?.trim() ?? '') === activeCategory)

  if (products.length === 0) {
    return (
      <p className="text-center text-ink-soft py-20">
        아직 등록된 제품이 없습니다. 곧 다시 확인해 주세요!
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {/* 카테고리 필터 탭 — 카테고리가 지정된 제품이 있을 때만 표시 */}
      {categories.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {['all', ...categories].map((cat) => {
            const active = activeCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`text-sm font-medium px-4 py-2 rounded-full border transition-colors ${
                  active
                    ? 'bg-pen text-white border-pen'
                    : 'text-ink-soft border-rule hover:text-ink hover:border-pen/40'
                }`}
              >
                {cat === 'all' ? '전체' : cat}
              </button>
            )
          })}
        </div>
      )}

      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {visibleProducts.map((product) => {
          // 목록 전용 짧은 소개(plain text)를 클램프 표시. 비어 있으면 아래 조건부 렌더로 설명 영역 자체를 생략
          const desc = (product.list_description ?? '').trim()
          const isLongDesc = desc.length > DESC_CHAR_LIMIT

          return (
            <div
              key={product.id}
              className={`relative flex flex-col border rounded-lg transition-all duration-300 group ${
                product.is_active
                  ? 'border-rule bg-paper-raised shadow-[0_1px_2px_rgba(35,39,46,0.05)] hover:border-ink-faint hover:shadow-[0_6px_20px_rgba(35,39,46,0.08)]'
                  : 'border-dashed border-rule bg-paper-shade/50 opacity-70'
              }`}
            >
              {/* 코너 글로우 */}
              {product.is_active && (
                <div
                  className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-[0.05]"
                  style={{ background: 'radial-gradient(circle, #1D3FB0, transparent)' }}
                />
              )}

              <div className="relative z-10 flex flex-col flex-1 p-7">
                {/* 로고 + 뱃지 */}
                <div className="flex items-start justify-between mb-5">
                  {(() => {
                    const text = product.badgeText ?? (product.is_active ? null : '출시 예정')
                    if (!text) return <div />
                    const colorCls = product.is_active
                      ? (PRODUCT_BADGE_COLORS_PAPER[product.badgeColor] ?? PRODUCT_BADGE_COLORS_PAPER.blue)
                      : 'text-ink-soft bg-paper-shade border-rule'
                    return (
                      <div className={`inline-flex items-center gap-1.5 border rounded-md px-2.5 py-1 text-xs font-semibold ${colorCls}`}>
                        {product.is_active ? <Sparkles size={11} /> : <Clock size={11} />}
                        {text}
                      </div>
                    )
                  })()}

                  {product.logo_url && (
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0">
                      <Image
                        src={product.logo_url}
                        alt={`${product.name} logo`}
                        fill
                        className="object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* 이름 + 카테고리 배지 & 태그라인 */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-xl font-bold text-ink">{product.name}</h3>
                  {product.category && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_BADGE_PAPER[product.category] ?? 'bg-paper-shade text-ink-soft border-rule'}`}>
                      {CATEGORY_LABELS[product.category] ?? product.category}
                    </span>
                  )}
                  {product.category_group && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-paper-shade text-ink-soft border-rule">
                      {product.category_group}
                    </span>
                  )}
                </div>
                {product.tagline && (
                  <p className="text-pen text-sm font-medium mb-4">{product.tagline}</p>
                )}

                {/* 설명 — 항상 3줄 클램프, "more" 클릭 시 하단 패널 열기 */}
                {desc && (
                  <div className="relative mb-4">
                    <p className="text-ink-soft text-sm leading-relaxed line-clamp-3">
                      {desc}
                    </p>
                    {isLongDesc && (
                      <Link
                        href={`/product/${product.slug}`}
                        className="absolute bottom-0 right-0 text-pen hover:text-pen-dark transition-colors font-medium text-sm"
                        style={{ background: 'linear-gradient(to right, transparent, #FFFFFF 30%)', paddingLeft: '1.5rem' }}
                      >
                        더보기
                      </Link>
                    )}
                  </div>
                )}

                {/* 태그 pill */}
                {product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-ink-soft border border-rule rounded-full px-3 py-1"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 가격 + CTA */}
                {product.is_active ? (
                  <div className="mt-auto mb-4">
                    {product.monthlyPrice != null && (
                      <div className="flex items-baseline gap-3 mb-4">
                        <span className="text-2xl font-bold text-ink">
                          {formatPrice(product.monthlyPrice)}
                          <span className="text-sm text-ink-soft font-normal">/월</span>
                        </span>
                        <span className="text-xs text-ink-faint">
                          VAT 포함{product.annualPrice != null ? ` · 또는 ${formatPrice(product.annualPrice)}/년` : ''}
                        </span>
                      </div>
                    )}
                    <Link
                      href={`/product/${product.slug}`}
                      className="w-full inline-flex items-center justify-center gap-2 bg-pen text-white font-semibold py-3 rounded-md text-sm hover:bg-pen-dark transition-all duration-200"
                    >
                      <Eye size={14} />
                      자세히 보기
                    </Link>
                  </div>
                ) : (
                  <div className="mt-auto mb-4">
                    <span className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-rule text-ink-faint font-medium py-3 rounded-md text-sm cursor-not-allowed">
                      출시 알림 받기
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
