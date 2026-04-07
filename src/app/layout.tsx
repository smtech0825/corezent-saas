import type { Metadata } from 'next'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n'
import LemonSqueezyOverlay from '@/components/LemonSqueezyOverlay'

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
        <LemonSqueezyOverlay />
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
