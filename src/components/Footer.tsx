/**
 * @컴포넌트: Footer
 * @설명: 사이트 하단 푸터 — DB의 footer_info를 fetch해 whitespace-pre-wrap으로 출력
 */

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

const footerLinks = {
  제품: [
    { label: '요금제', href: '/pricing' },
  ],
  회사: [
    { label: '회사소개', href: '/about' },
  ],
  자료: [
    { label: '사용 설명서', href: 'https://sites.google.com/view/corezent' },
    { label: '고객지원', href: '/dashboard/support' },
  ],
  약관: [
    { label: '개인정보처리방침', href: '/legal/privacy' },
    { label: '이용약관', href: '/legal/terms' },
    { label: '쿠키 정책', href: '/legal/cookies' },
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
            <p className="text-sm text-slate-500 leading-relaxed">
              여러분의 시간을 아끼고 디지털 워크플로우를 확장하는 차세대 AI 자동화 도구.
            </p>
          </div>

          {/* 링크 컬럼 */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-white mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('http') ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#94A3B8] hover:text-white transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-[#94A3B8] hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
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
