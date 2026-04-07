'use client'

/**
 * @컴포넌트: LemonSqueezyOverlay
 * @설명: Lemon Squeezy 오버레이 체크아웃 스크립트 로드 및 결제 성공 시 대시보드로 리다이렉트
 */

import { useEffect } from 'react'
import Script from 'next/script'

function setupLemonSqueezy() {
  if (typeof window === 'undefined') return
  const ls = (window as any).LemonSqueezy
  if (!ls) return
  ls.Setup({
    eventHandler: (event: any) => {
      if (event?.event === 'Checkout.Success') {
        window.location.href = '/dashboard/licenses'
      }
    },
  })
}

export default function LemonSqueezyOverlay() {
  useEffect(() => {
    // postMessage 폴백: LS가 iframe에서 부모로 메시지 전송 시 감지
    const handleMessage = (event: MessageEvent) => {
      const data = event.data
      if (
        data?.event === 'Checkout.Success' ||
        data?.type === 'checkout.success' ||
        data?.type === 'lemon:checkout:success'
      ) {
        window.location.href = '/dashboard/licenses'
      }
    }
    window.addEventListener('message', handleMessage)

    // 스크립트가 이미 로드된 경우 즉시 Setup 시도
    setupLemonSqueezy()

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <Script
      src="https://assets.lemonsqueezy.com/lemon.js"
      strategy="afterInteractive"
      onLoad={setupLemonSqueezy}
    />
  )
}
