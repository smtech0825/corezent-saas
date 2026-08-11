'use client'

/**
 * @컴포넌트: DeleteButton
 * @설명: 제품 삭제 버튼 — 확인 후 삭제 실행.
 *        서버 기능이 실패해도 버튼이 반드시 풀리도록 try/finally로 감싼다. 예전에는 권한이
 *        풀린 상태에서 누르면 예외가 그대로 올라가 버튼이 비활성인 채로 굳었다.
 */

import { useState } from 'react'
import { Trash2 } from 'lucide-react'

interface Props {
  productId: string
  productName: string
  /** 목록 화면에서 다른 조작이 진행 중이면 눌리지 않게 한다 */
  disabled?: boolean
  onDelete: (id: string) => Promise<void>
}

export default function DeleteButton({ productId, productName, disabled = false, onDelete }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (loading || disabled) return
    if (!confirm(`"${productName}" 제품을 삭제하시겠습니까?\n주문·라이선스 이력이 있는 제품은 완전 삭제 대신 비활성화됩니다. 이 작업은 되돌릴 수 없습니다.`)) return
    setLoading(true)
    try {
      await onDelete(productId)
    } catch (err) {
      // 결과값을 받지 못한 경우(연결 끊김 등). 안내는 목록 화면이 맡고, 여기서는 사유만 남긴다.
      console.error('[products] 삭제 요청 실패:', err)
    } finally {
      // 성공·실패와 무관하게 버튼을 풀어준다.
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading || disabled}
      className="p-1.5 text-ink-faint hover:text-danger transition-colors rounded disabled:opacity-50"
      title="삭제"
      aria-label={`${productName} 제품 삭제`}
    >
      <Trash2 size={14} />
    </button>
  )
}
