'use client'

/**
 * @컴포넌트: ProductFeaturesManager
 * @설명: 상품별 특징(features) 목록 관리 — 추가/수정/삭제
 *        /product 페이지에 표시될 "More Info" 확장 콘텐츠를 편집
 */

import { useState, useTransition } from 'react'
import { Plus, Trash2, Check, X, ChevronDown } from 'lucide-react'

interface Product {
  id: string
  name: string
  features: string[]
}

interface Props {
  products: Product[]
  onSave: (productId: string, features: string[]) => Promise<{ error?: string }>
}

export default function ProductFeaturesManager({ products, onSave }: Props) {
  const [openId, setOpenId] = useState<string | null>(products[0]?.id ?? null)
  const [drafts, setDrafts] = useState<Record<string, string[]>>(
    Object.fromEntries(products.map((p) => [p.id, [...p.features]]))
  )
  const [newTexts, setNewTexts] = useState<Record<string, string>>(
    Object.fromEntries(products.map((p) => [p.id, '']))
  )
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function updateFeature(productId: string, index: number, value: string) {
    setDrafts((prev) => {
      const list = [...prev[productId]]
      list[index] = value
      return { ...prev, [productId]: list }
    })
  }

  function removeFeature(productId: string, index: number) {
    setDrafts((prev) => ({
      ...prev,
      [productId]: prev[productId].filter((_, i) => i !== index),
    }))
  }

  function addFeature(productId: string) {
    const text = newTexts[productId]?.trim()
    if (!text) return
    setDrafts((prev) => ({
      ...prev,
      [productId]: [...prev[productId], text],
    }))
    setNewTexts((prev) => ({ ...prev, [productId]: '' }))
  }

  async function handleSave(productId: string) {
    const features = drafts[productId].filter((f) => f.trim() !== '')
    startTransition(async () => {
      const result = await onSave(productId, features)
      if (result.error) {
        setErrors((prev) => ({ ...prev, [productId]: result.error! }))
      } else {
        setSaved((prev) => ({ ...prev, [productId]: true }))
        setErrors((prev) => ({ ...prev, [productId]: '' }))
        setTimeout(() => setSaved((prev) => ({ ...prev, [productId]: false })), 2000)
      }
    })
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-[#1E293B] rounded-2xl">
        <p className="text-[#475569] text-sm">
          등록된 상품이 없습니다. 먼저{' '}
          <a href="/admin/products/new" className="text-amber-400 underline">
            상품을 추가
          </a>
          하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {products.map((product) => {
        const isOpen = openId === product.id
        const features = drafts[product.id] ?? []

        return (
          <div
            key={product.id}
            className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden"
          >
            {/* 상품 헤더 — 클릭 시 접기/펼치기 */}
            <button
              onClick={() => setOpenId(isOpen ? null : product.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#1E293B]/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-xs font-bold text-[#38BDF8]">
                  {product.name[0]}
                </span>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">{product.name}</p>
                  <p className="text-xs text-[#475569]">
                    {features.length} feature{features.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#475569] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* 편집 영역 */}
            {isOpen && (
              <div className="border-t border-[#1E293B] p-5 space-y-3">
                {/* 기존 특징 목록 */}
                {features.length === 0 && (
                  <p className="text-xs text-[#475569] py-2 text-center">
                    아직 특징이 없습니다. 아래에서 추가하세요.
                  </p>
                )}

                {features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <input
                      value={feat}
                      onChange={(e) => updateFeature(product.id, idx, e.target.value)}
                      placeholder="Feature description (e.g. AI Generation: Powered by 4 engines)"
                      className="flex-1 bg-[#0B1120] border border-[#1E293B] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50 placeholder-[#475569]"
                    />
                    <button
                      onClick={() => removeFeature(product.id, idx)}
                      className="p-2 text-[#475569] hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-colors mt-0.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {/* 새 특징 추가 입력 */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    value={newTexts[product.id] ?? ''}
                    onChange={(e) =>
                      setNewTexts((prev) => ({ ...prev, [product.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addFeature(product.id)
                      }
                    }}
                    placeholder="새 특징 입력 후 Enter 또는 + 클릭"
                    className="flex-1 bg-[#0B1120] border border-dashed border-[#1E293B] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50 placeholder-[#475569]"
                  />
                  <button
                    onClick={() => addFeature(product.id)}
                    disabled={!newTexts[product.id]?.trim()}
                    className="p-2 text-[#38BDF8] hover:text-white bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 rounded-lg transition-colors disabled:opacity-30"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* 에러 메시지 */}
                {errors[product.id] && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <X size={12} /> {errors[product.id]}
                  </p>
                )}

                {/* 저장 버튼 */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleSave(product.id)}
                    disabled={isPending}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
                      saved[product.id]
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : 'bg-amber-500 hover:bg-amber-400 text-[#0B1120] disabled:opacity-50'
                    }`}
                  >
                    {saved[product.id] ? (
                      <>
                        <Check size={13} /> Saved
                      </>
                    ) : (
                      <>
                        <Check size={13} /> Save Features
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
