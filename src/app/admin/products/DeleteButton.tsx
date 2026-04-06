'use client'

/**
 * @컴포넌트: DeleteButton
 * @설명: 제품 삭제 버튼 — 확인 후 삭제 실행
 */

import { useState } from 'react'
import { Trash2 } from 'lucide-react'

interface Props {
  productId: string
  productName: string
  onDelete: (id: string) => Promise<void>
}

export default function DeleteButton({ productId, productName, onDelete }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete "${productName}"? This cannot be undone.`)) return
    setLoading(true)
    await onDelete(productId)
    setLoading(false)
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 text-[#475569] hover:text-red-400 transition-colors rounded disabled:opacity-50"
      title="Delete"
    >
      <Trash2 size={14} />
    </button>
  )
}
