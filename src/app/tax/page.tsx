/**
 * @파일: tax/page.tsx
 * @설명: 부동산 계산기 허브 — 계산기 목록을 분류(살 때/가지고 있을 때/팔 때/물려줄 때/임대)별로
 *        보여준다. 준비 중인 계산기는 링크 없이 표시만 하고 '준비 중'으로 구분한다.
 *        목록의 단일 출처는 lib/tax/calculators.ts.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Calculator } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo'
import {
  CALCULATOR_CATEGORIES,
  CALCULATOR_CATEGORY_LABELS,
  TAX_CALCULATORS,
} from '@/lib/tax/calculators'
import CalcSection from './_components/CalcSection'

export const metadata: Metadata = buildPageMetadata({
  path: '/tax',
  title: '부동산 계산기 — 취득세·인지세 등 법령 근거 기반',
  description:
    '부동산을 사고, 보유하고, 팔고, 물려줄 때 필요한 세금·비용 계산기를 한곳에 모았습니다. 적용된 법령명·조문·시행일·원문 링크를 결과와 함께 보여드립니다.',
})

export default function TaxHubPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-10 sm:pt-12 pb-4 px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-pen/10 border border-pen/20 mb-6">
          <Calculator size={26} className="text-pen" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-black text-ink mb-3">부동산 계산기</h1>
        <p className="text-ink-soft text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          부동산을 사고, 보유하고, 팔고, 물려줄 때 필요한 세금과 비용을 계산합니다.
          모든 계산기는 숫자보다 근거를 먼저 보여드립니다 — 어느 법의 몇 조가, 언제
          시행된 것이 적용됐는지 결과와 함께 확인하세요.
        </p>
      </section>

      {/* 분류별 계산기 목록 */}
      <CalcSection className="space-y-8">
        {CALCULATOR_CATEGORIES.map((category) => {
          const items = TAX_CALCULATORS.filter((c) => c.category === category)
          if (items.length === 0) return null
          return (
            <div key={category}>
              <h2 className="font-serif font-bold text-ink mb-3">
                {CALCULATOR_CATEGORY_LABELS[category]}
              </h2>
              <ul className="space-y-2">
                {items.map((calc) =>
                  calc.available ? (
                    <li key={calc.slug}>
                      <Link
                        href={calc.path}
                        className="block bg-paper-raised border border-rule rounded-lg p-4 transition-colors hover:border-pen/40"
                      >
                        <span className="font-semibold text-ink">{calc.name}</span>
                        <span className="block text-xs text-ink-soft mt-1 leading-relaxed">
                          {calc.description}
                        </span>
                      </Link>
                    </li>
                  ) : (
                    <li key={calc.slug}>
                      {/* 준비 중 — 링크를 만들지 않아 눌리지 않고, 검색엔진에도 노출되지 않는다 */}
                      <div
                        aria-disabled="true"
                        className="bg-paper-raised/60 border border-rule rounded-lg p-4 cursor-not-allowed select-none"
                      >
                        <span className="font-semibold text-ink-faint">{calc.name}</span>
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-faint">
                          준비 중
                        </span>
                        <span className="block text-xs text-ink-faint mt-1 leading-relaxed">
                          {calc.description}
                        </span>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )
        })}
      </CalcSection>
    </>
  )
}
