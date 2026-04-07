'use client'

/**
 * @컴포넌트: LemonSqueezyOverlay
 * @설명: Lemon Squeezy 오버레이 체크아웃 스크립트 로드 및 결제 성공 시 대시보드로 리다이렉트
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'

export default function LemonSqueezyOverlay() {
  const router = useRouter()

  useEffect(() => {
    // 결제 성공 이벤트 수신 → 대시보드 라이선스 페이지로 이동
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin.includes('lemonsqueezy.com') &&
        event.data?.event === 'Checkout.Success'
      ) {
        router.push('/dashboard/licenses')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [router])

  return (
    <Script
      src="https://assets.lemonsqueezy.com/lemon.js"
      strategy="afterInteractive"
      onLoad={() => {
        // LS 오버레이 초기화 및 결제 성공 핸들러 등록
        if (typeof window !== 'undefined' && (window as any).LemonSqueezy) {
          ;(window as any).LemonSqueezy.Setup({
            eventHandler: (event: any) => {
              if (event?.event === 'Checkout.Success') {
                router.push('/dashboard/licenses')
              }
            },
          })
        }
      }}
    />
  )
}
