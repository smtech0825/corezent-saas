'use client'

/**
 * @컴포넌트: TaxNav
 * @설명: 계산기 전환 탭 — <Link> 클라이언트 네비게이션이라 주소만 바뀌고 페이지 전체가
 *        새로 로드되지 않는다(공유 레이아웃은 그대로 유지). 현재 경로와 일치하는
 *        계산기를 강조하고, 준비 중인 계산기는 링크를 만들지 않고 표시만 한다
 *        (눌리지 않으며 검색엔진에 잘못된 링크가 노출되지 않는다).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TAX_CALCULATORS } from '@/lib/tax/calculators'

export default function TaxNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="부동산 계산기 목록" className="flex flex-wrap justify-center gap-1.5">
      {TAX_CALCULATORS.map((calc) => {
        if (!calc.available) {
          return (
            <span
              key={calc.slug}
              aria-disabled="true"
              title="준비 중인 계산기입니다"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-ink-faint border border-rule bg-paper-shade/50 cursor-not-allowed select-none"
            >
              {calc.name}
              <span className="px-1 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-faint">
                준비 중
              </span>
            </span>
          )
        }
        const active = pathname === calc.path
        return (
          <Link
            key={calc.slug}
            href={calc.path}
            aria-current={active ? 'page' : undefined}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              active
                ? 'bg-pen text-white border-pen'
                : 'border-rule text-ink-soft hover:text-ink hover:border-pen/40'
            }`}
          >
            {calc.name}
          </Link>
        )
      })}
    </nav>
  )
}
