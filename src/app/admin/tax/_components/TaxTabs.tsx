/**
 * @컴포넌트: TaxTabs
 * @설명: 세금 관리 영역 상단 탭 — 룰 편집 / 규제지역 / 법령 개정 화면 전환.
 *        법령 개정 탭에는 미확인(pending) 건수를 배지로 붙인다 — 감지만 되고
 *        아무도 보지 않는 상태를 눈에 띄게 하기 위해서다.
 */

import Link from 'next/link'

const TABS = [
  { key: 'rules', label: '룰 편집', href: '/admin/tax/rules' },
  { key: 'areas', label: '규제지역', href: '/admin/tax/areas' },
  { key: 'law-changes', label: '법령 개정', href: '/admin/tax/law-changes' },
] as const

export type TaxTabKey = (typeof TABS)[number]['key']

export default function TaxTabs({
  active,
  pendingLawChanges = 0,
}: {
  active: TaxTabKey
  /** 법령 개정 탭에 띄울 미확인 건수 — 0이면 배지를 달지 않는다 */
  pendingLawChanges?: number
}) {
  return (
    <div className="flex gap-1 border-b border-rule">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
            active === tab.key
              ? 'border-mark text-mark bg-paper-raised'
              : 'border-transparent text-ink-soft hover:text-ink'
          }`}
        >
          {tab.label}
          {tab.key === 'law-changes' && pendingLawChanges > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-caution text-paper"
              aria-label={`미확인 ${pendingLawChanges}건`}
            >
              {pendingLawChanges}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}
