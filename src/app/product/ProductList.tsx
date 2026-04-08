'use client'

/**
 * @컴포넌트: ProductList
 * @설명: /product 페이지의 상품 카드 목록
 *        - DB에서 가져온 상품 표시
 *        - "More Info" 클릭 시 상품 특징 아코디언 확장
 */

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, Clock, ChevronDown, Check, ArrowRight } from 'lucide-react'

interface Product {
  id: string
  name: string
  tagline: string | null
  description: string | null
  category: string
  features: string[]
  tags: string[]
  logo_url: string | null
  is_active: boolean
  monthlyPrice: number | null
  annualPrice: number | null
}

interface Props {
  products: Product[]
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {products.map((product) => {
        const isExpanded = expandedId === product.id
        const hasFeatures = product.features.length > 0

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

                {/* 로고 이미지 */}
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

              {/* 설명 */}
              {product.description && (
                <p className="text-[#94A3B8] text-sm leading-relaxed mb-4">
                  {product.description}
                </p>
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
                  <Link
                    href="/pricing"
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#38BDF8] text-[#0B1120] font-semibold py-2.5 rounded-xl text-sm hover:bg-[#0ea5e9] transition-all duration-200"
                  >
                    Get started
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="mt-auto mb-4">
                  <Link
                    href="/auth/register"
                    className="w-full inline-flex items-center justify-center gap-2 border border-[#1E293B] text-[#475569] font-medium py-2.5 rounded-xl text-sm"
                    tabIndex={-1}
                  >
                    Notify me
                  </Link>
                </div>
              )}

              {/* More Info 토글 버튼 */}
              {hasFeatures && (
                <button
                  onClick={() => toggle(product.id)}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-[#94A3B8] hover:text-[#38BDF8] border border-[#1E293B] hover:border-[#38BDF8]/30 py-2.5 rounded-xl transition-all duration-200"
                >
                  More Info
                  <ChevronDown
                    size={15}
                    className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            </div>

            {/* 확장 패널 — 상품 특징 */}
            {isExpanded && hasFeatures && (
              <div className="relative z-10 border-t border-[#1E293B] px-7 py-5">
                <p className="text-xs font-semibold text-[#475569] uppercase tracking-widest mb-4">
                  Features
                </p>
                <ul className="space-y-3">
                  {product.features.map((feature, i) => {
                    const colonIdx = feature.indexOf(':')
                    const [title, desc] =
                      colonIdx !== -1
                        ? [feature.slice(0, colonIdx).trim(), feature.slice(colonIdx + 1).trim()]
                        : [feature, null]
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <Check size={14} className="text-[#38BDF8] mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-[#94A3B8] leading-relaxed">
                          {desc ? (
                            <>
                              <strong className="text-[#F1F5F9]">{title}:</strong> {desc}
                            </>
                          ) : (
                            title
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
