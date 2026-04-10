'use client'

/**
 * @컴포넌트: Analytics
 * @설명: 분석 스크립트 로더 — 쿠키 동의 상태에 따라 조건부 활성화
 *        - GA4 (Google Analytics 4): 전환 및 트래픽 분석
 *        - PostHog: 행동 분석 (토글 클릭, 이탈 등)
 *        - Meta Pixel: Facebook 리타겟팅
 *        동의 없이는 어떤 스크립트도 로드되지 않습니다.
 */

import Script from 'next/script'
import { useState, useEffect } from 'react'
import { getConsent, captureUtmFromSearch, type ConsentLevel } from '@/lib/cookies'

// 환경변수에서 각 서비스 ID 로드 (미설정 시 해당 스크립트 건너뜀)
const GA4_ID        = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
const POSTHOG_KEY   = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST  = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

export default function Analytics() {
  const [consent, setConsent] = useState<ConsentLevel | null>(null)

  useEffect(() => {
    // UTM 파라미터 캡처 (동의 여부 무관 — 첫 방문 출처 보존)
    captureUtmFromSearch(window.location.search)

    // 초기 동의 상태 읽기
    setConsent(getConsent())

    // 동의 변경 이벤트 구독 (배너에서 버튼 클릭 시 스크립트 즉시 활성화)
    const handler = (e: Event) => {
      setConsent((e as CustomEvent<ConsentLevel>).detail)
    }
    window.addEventListener('cookie-consent-updated', handler)
    return () => window.removeEventListener('cookie-consent-updated', handler)
  }, [])

  // 동의 미확인 또는 필수 쿠키만 → 스크립트 로드 안 함
  if (consent !== 'all') return null

  return (
    <>
      {/* ── Google Analytics 4 ─────────────────────────────────────────────── */}
      {GA4_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA4_ID}', { anonymize_ip: true });
          `}</Script>
        </>
      )}

      {/* ── PostHog (행동 분석) ─────────────────────────────────────────────── */}
      {POSTHOG_KEY && (
        <Script id="posthog-init" strategy="afterInteractive">{`
          !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}var u=t.createElement("script");u.type="text/javascript",u.async=!0,u.src=s.api_host+"/static/array.js";var l=t.getElementsByTagName("script")[0];l.parentNode.insertBefore(u,l);var _=e;for(void 0!==a?_=e[a]=[]:a="posthog",_.people=_.people||[],_.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},_.people.toString=_.people.toString,o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys".split(" "),n=0;n<o.length;n++)g(_,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
          posthog.init('${POSTHOG_KEY}',{api_host:'${POSTHOG_HOST}',capture_pageview:true,persistence:'cookie'});
        `}</Script>
      )}

      {/* ── Meta Pixel (Facebook 리타겟팅) ────────────────────────────────── */}
      {META_PIXEL_ID && (
        <Script id="meta-pixel-init" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${META_PIXEL_ID}');
          fbq('track','PageView');
        `}</Script>
      )}
    </>
  )
}
