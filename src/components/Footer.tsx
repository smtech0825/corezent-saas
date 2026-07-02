/**
 * @컴포넌트: Footer
 * @설명: 사이트 하단 푸터 — 공문서 결문(結文) 스타일.
 *        DB의 footer_info를 fetch해 whitespace-pre-wrap으로 출력하고,
 *        문서가 끝나는 자리에 "끝." 표기를 남긴다.
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
    <footer className="border-t-2 border-ink bg-paper-shade/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 sm:gap-10">

          {/* 브랜드 */}
          <div className="col-span-2 sm:col-span-3 md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-lg text-ink mb-4">
              <span className="w-7 h-7 rounded border-[1.5px] border-seal flex items-center justify-center text-seal text-sm font-black -rotate-3">C</span>
              CoreZent
            </div>
            <p className="text-sm text-ink-soft leading-relaxed break-keep">
              업무를 더 쉽게 만드는 소프트웨어를 직접 만들고 판매합니다.
            </p>
          </div>

          {/* 링크 컬럼 */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-bold text-ink mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('http') ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-ink-soft hover:text-ink transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-ink-soft hover:text-ink transition-colors"
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

        {/* 하단 바 — 사업자 정보 */}
        <div className="mt-12 pt-8 border-t border-rule flex flex-col sm:flex-row justify-between items-start gap-4">
          <p className="text-xs text-ink-faint shrink-0">{copyright}</p>
          {footerInfo && (
            <p
              className="text-xs text-ink-faint sm:text-right"
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
