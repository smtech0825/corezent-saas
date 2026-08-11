/**
 * @컴포넌트: TaxTabs
 * @설명: 세금 관리 영역 상단 탭 — 룰 편집 / 규제지역 화면 전환.
 */

import Link from 'next/link'

const TABS = [
  { key: 'rules', label: '룰 편집', href: '/admin/tax/rules' },
  { key: 'areas', label: '규제지역', href: '/admin/tax/areas' },
] as const

export default function TaxTabs({ active }: { active: 'rules' | 'areas' }) {
  return (
    <div className="flex gap-1 border-b border-rule">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
            active === tab.key
              ? 'border-mark text-mark bg-paper-raised'
              : 'border-transparent text-ink-soft hover:text-ink'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
