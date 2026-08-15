'use client'

/**
 * @컴포넌트: PurchaseTracker
 * @설명: 결제 완료 측정 전용 — 주문 완료 페이지 도착 시 purchase 사건을 1회 보낸다.
 *        화면에는 아무것도 그리지 않는다. 새로고침·뒤로가기 재방문으로 같은 주문이
 *        중복 집계되지 않도록 브라우저 세션 저장소로 1회를 보장한다.
 *        ⚠️ 개인정보 금지 — 값은 상품명뿐(주문번호·이름·이메일을 담지 않는다).
 *        측정이 실패해도 페이지(본 동작)는 그대로 동작한다.
 */

import { useEffect } from 'react'
import { EVENT, trackEvent } from '@/lib/analytics-events'

interface Props {
  /** 중복 집계 방지 키(주문 id — 사건 값으로는 보내지 않음). 없으면 세션당 1회 */
  dedupeKey: string | null
  /** 사건에 담을 상품명(개인정보 아님). 없으면 값 없이 보낸다 */
  product: string | null
}

export default function PurchaseTracker({ dedupeKey, product }: Props) {
  useEffect(() => {
    const key = `purchase_tracked_${dedupeKey ?? 'session'}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { /* 저장소 접근 불가(시크릿 등)면 중복 방지 없이 1회 전송 */ }
    trackEvent(EVENT.PURCHASE, product ? { product } : undefined)
  }, [dedupeKey, product])

  return null
}
