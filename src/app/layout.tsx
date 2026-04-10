import type { Metadata } from 'next'
import './globals.css'
import Analytics from '@/components/Analytics'
import CookieConsentBanner from '@/components/CookieConsentBanner'

export const metadata: Metadata = {
  title: {
    default: 'CoreZent — Software Built for You',
    template: '%s | CoreZent',
  },
  description:
    'CoreZent creates and sells thoughtfully-built software — from AI automation tools to productivity apps. Simple pricing, instant activation.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* 분석 스크립트 (쿠키 동의 시에만 로드) */}
        <Analytics />
        {/* GDPR/CCPA 쿠키 동의 배너 */}
        <CookieConsentBanner />
      </body>
    </html>
  )
}
