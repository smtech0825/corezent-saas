/**
 * @파일: app/layout.tsx
 * @설명: 루트 레이아웃 — DB의 SEO 설정을 generateMetadata로 동적 주입
 *        Google Analytics ID가 설정된 경우 next/script로 전 페이지에 GTAG 로드
 */

import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import Analytics from '@/components/Analytics'
import CookieConsentBanner from '@/components/CookieConsentBanner'
import { createAdminClient } from '@/lib/supabase/admin'
import { Analytics as VercelAnalytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

// ─── 동적 메타데이터 (DB SEO 설정 반영) ─────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  try {
    const adminClient = createAdminClient()
    const { data: rows } = await adminClient
      .from('front_settings')
      .select('key, value')
      .in('key', ['seo_meta_title', 'seo_meta_description', 'seo_meta_keywords'])

    const map = new Map((rows ?? []).map((r) => [r.key, r.value ?? '']))

    const title       = map.get('seo_meta_title')       || 'CoreZent — Software Built for You'
    const description = map.get('seo_meta_description') || 'CoreZent creates and sells thoughtfully-built software — from AI automation tools to productivity apps. Simple pricing, instant activation.'
    const keywords    = map.get('seo_meta_keywords')    || ''

    return {
      title:       { default: title, template: '%s | CoreZent' },
      description,
      ...(keywords ? { keywords: keywords.split(',').map((k: string) => k.trim()).filter(Boolean) } : {}),
    }
  } catch {
    // DB 조회 실패 시 기본값 사용
    return {
      title:       { default: 'CoreZent — Software Built for You', template: '%s | CoreZent' },
      description: 'CoreZent creates and sells thoughtfully-built software — from AI automation tools to productivity apps. Simple pricing, instant activation.',
    }
  }
}

// ─── 루트 레이아웃 ────────────────────────────────────────────────────────────

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // GA Tracking ID를 DB에서 fetch (실패 시 조용히 무시)
  let gaId = ''
  try {
    const adminClient = createAdminClient()
    const { data: rows } = await adminClient
      .from('front_settings')
      .select('key, value')
      .eq('key', 'seo_ga_tracking_id')
      .limit(1)
    gaId = rows?.[0]?.value ?? ''
  } catch {
    // 환경 변수 미설정 등 실패 시 스킵
  }

  // XSS 방지: G-XXXXXXXXXX 또는 UA-XXXXXX-X 형식만 허용
  const isValidGaId = /^(G-|UA-)[A-Z0-9-]+$/i.test(gaId)

  return (
    <html lang="en">
      <body>
        {children}
        {/* 분석 스크립트 (쿠키 동의 시에만 로드) */}
        <Analytics />
        {/* GDPR/CCPA 쿠키 동의 배너 */}
        <CookieConsentBanner />
        {/* Vercel Analytics & Speed Insights */}
        <VercelAnalytics />
        <SpeedInsights />
        {/* DB SEO Settings의 GA Tracking ID — 유효한 경우에만 로드 */}
        {isValidGaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}')`}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
