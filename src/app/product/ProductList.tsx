'use client'

/**
 * @컴포넌트: ProductList
 * @설명: /product 페이지의 상품 카드 목록
 *        - Description 3줄 제한 + "more" 링크
 *        - "View Details" 버튼 클릭 시 아래에 확장 박스 슬라이드
 *        - 확장 박스: 전체 Description + product_features (아이콘/이미지 + 제목 + 설명)
 */

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Sparkles, Clock, ChevronDown, Eye } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import * as TablerIcons from '@tabler/icons-react'
import * as RadixIcons from '@radix-ui/react-icons'

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
  tagline: string | null
  description: string | null
  category: string
  features: string[]
  tags: string[]
  product_features: ProductFeature[]
  logo_url: string | null
  is_active: boolean
  monthlyPrice: number | null
  annualPrice: number | null
}

interface Props {
  products: Product[]
}

/**
 * 멀티 라이브러리 아이콘 렌더러
 * - 접두사 없음 또는 lu: → Lucide (예: Cpu, lu:Cpu)
 * - tb: → Tabler Icons (예: tb:Cpu → IconCpu)
 * - ri: → Radix Icons (예: ri:Accessibility → AccessibilityIcon)
 */
function DynamicIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  type IconComp = React.ComponentType<{ size?: number; width?: number; height?: number; className?: string }>

  if (name.startsWith('tb:')) {
    const iconName = 'Icon' + name.slice(3)
    const icons = TablerIcons as unknown as Record<string, IconComp>
    const Icon = icons[iconName]
    if (!Icon) return null
    return <Icon size={size} className={className} />
  }

  if (name.startsWith('ri:')) {
    const iconName = name.slice(3) + 'Icon'
    const icons = RadixIcons as unknown as Record<string, IconComp>
    const Icon = icons[iconName]
    if (!Icon) return null
    return <Icon width={size} height={size} className={className} />
  }

  // Lucide (기본 또는 lu: 접두사)
  const lucideName = name.startsWith('lu:') ? name.slice(3) : name
  const icons = LucideIcons as unknown as Record<string, IconComp>
  const Icon = icons[lucideName]
  if (!Icon) return null
  return <Icon size={size} className={className} />
}

export default function ProductList({ products }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (products.length === 0) {
    return (
      <p className="text-center text-[#94A3B8] py-20">
        No products available yet. Check back soon!
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {products.map((product) => {
          const isExpanded = expandedId === product.id
          const desc = product.description ?? ''
          const isLongDesc = desc.length > DESC_CHAR_LIMIT

          return (
            <div
              key={product.id}
              className={`relative flex flex-col border rounded-2xl transition-all duration-300 group ${
                product.is_active
                  ? 'border-[#38BDF8]/20 bg-[#111A2E] hover:border-[#38BDF8]/40'
                  : 'border-[#1E293B] bg-[#0E1525] opacity-60'
              }`}
            >
              {/* 코너 글로우 */}
              {product.is_active && (
                <div
                  className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-[0.08]"
                  style={{ background: 'radial-gradient(circle, #38BDF8, transparent)' }}
                />
              )}

              <div className="relative z-10 flex flex-col flex-1 p-7">
                {/* 로고 + 뱃지 */}
                <div className="flex items-start justify-between mb-5">
                  <div
                    className={`inline-flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      product.is_active
                        ? 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20'
                        : 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]'
                    }`}
                  >
                    {product.is_active ? <Sparkles size={11} /> : <Clock size={11} />}
                    {product.is_active ? 'Available now' : 'Coming soon'}
                  </div>

                  {product.logo_url && (
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
                      <Image
                        src={product.logo_url}
                        alt={`${product.name} logo`}
                        fill
                        className="object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* 이름 & 태그라인 */}
                <h3 className="text-xl font-bold text-white mb-1">{product.name}</h3>
                {product.tagline && (
                  <p className="text-[#38BDF8] text-sm font-medium mb-4">{product.tagline}</p>
                )}

                {/* 설명 — 항상 3줄 클램프, "more" 클릭 시 하단 패널 열기 */}
                {desc && (
                  <div className="relative mb-4">
                    <p className="text-[#94A3B8] text-sm leading-relaxed line-clamp-3">
                      {desc}
                    </p>
                    {isLongDesc && (
                      <button
                        onClick={() => toggle(product.id)}
                        className="absolute bottom-0 right-0 text-[#38BDF8] hover:text-white transition-colors font-medium text-sm"
                        style={{ background: 'linear-gradient(to right, transparent, #111A2E 30%)', paddingLeft: '1.5rem' }}
                      >
                        more
                      </button>
                    )}
                  </div>
                )}

                {/* 태그 pill */}
                {product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-[#94A3B8] border border-[#1E293B] rounded-full px-3 py-1"
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
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl font-bold text-white">
                          ${product.monthlyPrice.toFixed(2)}
                          <span className="text-sm text-[#94A3B8] font-normal">/mo</span>
                        </span>
                        {product.annualPrice != null && (
                          <span className="text-xs text-[#475569]">
                            or ${product.annualPrice}/yr
                          </span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => toggle(product.id)}
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold py-2.5 rounded-xl text-sm hover:bg-[#0ea5e9] transition-all duration-200"
                    >
                      <Eye size={14} />
                      View Details
                    </button>
                  </div>
                ) : (
                  <div className="mt-auto mb-4">
                    <span className="w-full inline-flex items-center justify-center gap-2 border border-[#1E293B] text-[#475569] font-medium py-2.5 rounded-xl text-sm cursor-not-allowed">
                      Notify me
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 확장 상세 박스 — 카드 그리드 아래에 슬라이드 애니메이션으로 표시 */}
      {products.map((product) => {
        const isExpanded = expandedId === product.id
        if (!product.is_active) return null

        return (
          <ExpandPanel
            key={product.id}
            product={product}
            isExpanded={isExpanded}
          />
        )
      })}
    </div>
  )
}

/** 확장 패널 — 슬라이드 애니메이션 */
function ExpandPanel({ product, isExpanded }: { product: Product; isExpanded: boolean }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (isExpanded && contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    } else {
      setHeight(0)
    }
  }, [isExpanded])

  return (
    <div
      className="overflow-hidden transition-all duration-500 ease-in-out"
      style={{ maxHeight: isExpanded ? height + 32 : 0, opacity: isExpanded ? 1 : 0 }}
    >
      <div
        ref={contentRef}
        className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-8"
      >
        {/* 전체 Description */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-white mb-1">{product.name}</h3>
          {product.tagline && (
            <p className="text-[#38BDF8] text-sm font-medium mb-4">{product.tagline}</p>
          )}
          {product.description && (
            <p className="text-[#94A3B8] text-sm leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        {/* Product Features 그리드 */}
        {product.product_features.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#475569] uppercase tracking-widest mb-6">
              Features
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {product.product_features.map((feat, i) => (
                <div
                  key={i}
                  className="border border-[#1E293B] bg-[#0B1120] rounded-xl p-5 space-y-3"
                >
                  {/* 아이콘 또는 이미지 */}
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#111A2E] border border-[#1E293B]">
                    {feat.image_url ? (
                      <div className="relative w-8 h-8">
                        <Image
                          src={feat.image_url}
                          alt={feat.title}
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : feat.icon ? (
                      <DynamicIcon name={feat.icon} size={20} className="text-[#38BDF8]" />
                    ) : (
                      <Sparkles size={20} className="text-[#38BDF8]" />
                    )}
                  </div>

                  <h4 className="text-sm font-semibold text-white">{feat.title}</h4>
                  {feat.description && (
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      {feat.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
