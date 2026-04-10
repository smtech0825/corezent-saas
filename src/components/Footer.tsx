/**
 * @컴포넌트: Footer
 * @설명: 사이트 하단 푸터 — DB의 footer_info를 fetch해 whitespace-pre-wrap으로 출력
 */

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

const footerLinks = {
  Product: [
    { label: 'Pricing', href: '/pricing' },
  ],
  Company: [
    { label: 'About', href: '/about' },
  ],
  Resources: [
    { label: 'Documentation', href: '/manuals' },
    { label: 'Support', href: '/dashboard/support' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/legal/privacy' },
    { label: 'Terms of Service', href: '/legal/terms' },
    { label: 'Cookie Policy', href: '/legal/cookies' },
  ],
}

export default async function Footer() {
  const adminClient = createAdminClient()
  const { data: rows } = await adminClient
    .from('front_settings')
    .select('key, value')
    .in('key', ['footer_info', 'footer_copyright'])

  const map = new Map((rows ?? []).map((r) => [r.key, r.value ?? '']))
  const footerInfo  = map.get('footer_info') ?? ''
  const copyright   = map.get('footer_copyright') ?? `© ${new Date().getFullYear()} CoreZent Inc. All rights reserved.`

  return (
    <footer className="border-t border-[#1E293B] bg-[#0B1120]">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 sm:gap-10">

          {/* 브랜드 */}
          <div className="col-span-2 sm:col-span-3 md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-lg text-white mb-4">
              <span className="w-7 h-7 rounded-lg bg-[#38BDF8] flex items-center justify-center text-[#0B1120] text-sm font-black">C</span>
              CoreZent
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Software subscription &amp; license management for modern teams.
            </p>
          </div>

          {/* 링크 컬럼 */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-white mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#94A3B8] hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 하단 바 */}
        <div className="mt-12 pt-8 border-t border-[#1E293B] flex flex-col sm:flex-row justify-between items-start gap-4">
          <p className="text-xs text-[#94A3B8] shrink-0">{copyright}</p>
          {footerInfo && (
            <p
              className="text-xs text-[#94A3B8] sm:text-right"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {footerInfo}
            </p>
          )}
        </div>
      </div>
    </footer>
  )
}
