'use client'

/**
 * @컴포넌트: LemonSqueezyOverlay
 * @설명: Lemon Squeezy 오버레이 체크아웃 스크립트 로드 및 결제 성공 시 대시보드로 리다이렉트
 */

import Script from 'next/script'

export default function LemonSqueezyOverlay() {
  return (
    <>
      <Script
        src="https://assets.lemonsqueezy.com/lemon.js"
        strategy="afterInteractive"
      />
      <Script
        id="ls-setup"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function waitForLS() {
              if (window.LemonSqueezy && window.LemonSqueezy.Setup) {
                LemonSqueezy.Setup({
                  eventHandler: function(event) {
                    if (event.event === 'Checkout.Success') {
                      window.location.href = '/dashboard/licenses';
                    }
                  }
                });
              } else {
                setTimeout(waitForLS, 150);
              }
            })();
          `,
        }}
      />
    </>
  )
}
