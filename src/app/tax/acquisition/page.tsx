/**
 * @파일: tax/acquisition/page.tsx
 * @설명: 부동산 취득세 계산기 — 주택 유상취득(매매)·증여(무상취득).
 *        이 계산기의 목적은 세액보다 근거(어느 법 몇 조가, 언제 시행된 것이 적용됐는지)를
 *        보여주는 것이다. 하단에 참고용 고지와 마지막 룰 갱신일을 고정 표시한다.
 *        테마·Navbar·Footer·계산기 전환 탭은 공유 레이아웃(tax/layout.tsx)이 담당한다.
 */

import type { Metadata } from 'next'
import { Landmark } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo'
import ApartmentOnlyNotice from '../_components/ApartmentOnlyNotice'
import CalcSection, { CalcNotes } from '../_components/CalcSection'
import RuleBasisBanner from '../_components/RuleBasisBanner'
import CalculatorForm from './CalculatorForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildPageMetadata({
  path: '/tax/acquisition',
  title: '부동산 취득세 계산기 — 법령 근거 기반',
  description:
    '주택 유상취득·증여 취득세를 법령 근거와 함께 계산합니다. 적용된 법령명·조문·시행일·원문 링크를 결과에 그대로 표시하고, 확정된 법과 개정안을 분리해 보여줍니다.',
})

export default async function AcquisitionTaxPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-8 sm:pt-10 pb-4 px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-pen/10 border border-pen/20 mb-6">
          <Landmark size={26} className="text-pen" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-black text-ink mb-3">
          부동산 취득세 계산기
        </h1>
        <p className="text-ink-soft text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          숫자보다 근거를 먼저 보여드립니다. 어느 법의 몇 조가, 언제 시행된 것이
          적용됐는지 결과와 함께 확인하세요. 확정된 법과 아직 국회를 통과하지 않은
          개정안은 분리해 계산합니다.
        </p>
      </section>

      {/* 계산기 */}
      <CalcSection>
        <RuleBasisBanner taxTypes={['acquisition', 'common']} />
        <ApartmentOnlyNotice />
        <CalculatorForm />

        <CalcNotes>
        {/* 하단 고정 문구 — 참고용 고지 (갱신일은 상단 기준일 배너가 단일 출처) */}
        <div className="mt-8 border-t border-rule pt-5 text-center">
          <p className="text-xs text-ink-soft leading-relaxed">
            본 계산기는 참고용이며 법적 효력이 없습니다. 실제 신고·납부 세액은 위택스,
            관할 지방자치단체 또는 세무 전문가를 통해 반드시 확인하시기 바랍니다.
          </p>
        </div>
        </CalcNotes>
      </CalcSection>
    </>
  )
}
