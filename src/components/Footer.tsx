import Link from 'next/link'

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

export default function Footer() {
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
        <div className="mt-12 pt-8 border-t border-[#1E293B] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-[#94A3B8]">
            © {new Date().getFullYear()} CoreZent Inc. All rights reserved.
          </p>
          <p className="text-xs text-[#94A3B8]">
            사업자등록번호: 000-00-00000 | 대표: CoreZent
          </p>
        </div>
      </div>
    </footer>
  )
}
