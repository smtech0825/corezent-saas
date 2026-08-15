/**
 * @파일: tax/comprehensive/page.tsx
 * @설명: 부동산 종합부동산세 계산기(주택분·인별) — "나도 내는 건가"에 먼저 답하는 계산기.
 *        다른 계산기와 같은 원칙: 근거를 먼저 보여주고, 룰이 없으면 0원 대신 안내하며,
 *        판단 한계(제외 특례)를 화면에 명시한다. 재산세 상당액 공제는 자동 계산된다.
 *        테마·Navbar·Footer·계산기 전환 탭은 공유 레이아웃(tax/layout.tsx)이 담당한다.
 */

import type { Metadata } from 'next'
import { Coins } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo'
import { TAX_CALCULATORS } from '@/lib/tax/calculators'
import ApartmentOnlyNotice from '../_components/ApartmentOnlyNotice'
import CalcSection, { CalcNotes } from '../_components/CalcSection'
import RuleBasisBanner from '../_components/RuleBasisBanner'
import ComprehensiveForm from './ComprehensiveForm'

export const dynamic = 'force-dynamic'

/** 이 계산기의 목록 항목 — 열림 여부(available)의 단일 출처는 calculators.ts */
const CALC_INFO = TAX_CALCULATORS.find((c) => c.slug === 'comprehensive')

export const metadata: Metadata = {
  ...buildPageMetadata({
    path: '/tax/comprehensive',
    title: '종합부동산세 계산기 — 법령 근거 기반',
    description:
      '종합부동산세 과세 대상인지부터 답합니다. 공시가격 합계와 주택 수만으로 기본공제·공정시장가액비율·일반/중과 세율·재산세 상당액 공제·1세대 1주택 세액공제·세부담 상한까지, 적용된 법령명·조문·시행일·원문 링크를 결과에 그대로 표시합니다.',
  }),
  // 준비 중(available:false)인 동안은 검색엔진 색인 금지 — 룰 미등록 안내 화면이 검색에
  // 잡히지 않게 한다. available:true로 열면 자동 해제 (다른 계산기와 같은 방식).
  ...(CALC_INFO?.available ? {} : { robots: { index: false, follow: false } }),
}

export default function ComprehensiveTaxPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-8 sm:pt-10 pb-4 px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-pen/10 border border-pen/20 mb-6">
          <Coins size={26} className="text-pen" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-black text-ink mb-3">
          종합부동산세 계산기
        </h1>
        <p className="text-ink-soft text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          내가 종합부동산세 과세 대상인지부터 답합니다. 주택을 한 채씩 등록할 필요 없이
          공시가격 합계와 주택 수만 넣으면, 기본공제·세율·재산세 공제·세액공제·상한이
          어느 법 몇 조로 어떻게 적용됐는지 근거와 함께 보여드립니다.
        </p>
      </section>

      {/* 계산기 */}
      <CalcSection>
        <RuleBasisBanner taxTypes={['comprehensive']} />
        <ApartmentOnlyNotice />
        <ComprehensiveForm />

        <CalcNotes>
        {/* 판단 한계 안내 — 이 계산기가 반영하지 못하는 것들(제외 특례 명시) */}
        <div className="mt-8 bg-paper-raised border border-rule rounded-lg p-5">
          <p className="text-sm font-semibold text-ink mb-2">계산 전에 확인하세요</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-soft leading-relaxed">
            <li>
              특례주택의 주택 수 제외는 반영되지 않습니다: 일시적 2주택·상속주택·지방
              저가주택을 주택 수에서 빼는 특례에 해당한다면 실제 세액이 달라질 수 있으니
              세무 전문가와 확인하세요.
            </li>
            <li>부부 공동명의 1주택자 특례(공동명의 단독 신고 선택)는 반영되지 않습니다.</li>
            <li>법인 소유 주택은 지원하지 않습니다.</li>
            <li>
              재산세 상당액 공제는 등록된 재산세 룰(표준세율)로 자동 계산합니다 — 실제
              부과된 재산세와 차이가 있을 수 있습니다.
            </li>
            <li>
              직전 연도 총세액을 비우면 세부담 상한이 적용되지 않아 실제 고지서보다 높게
              나올 수 있습니다 — 상한은 세금을 낮추는 방향으로만 작동합니다.
            </li>
            <li>
              기본값(확정된 법 기준)에는 확정되지 않은 개편안이 반영되지 않습니다.
              &lsquo;개정안 포함&rsquo;을 선택하면 국회 통과 전 개편안 룰을 포함해 참고용으로
              계산하며, 항목별 시행 시점(2027·2028·2029년)에 따라 과세연도 기준으로 적용됩니다.
            </li>
          </ul>
        </div>

        {/* 하단 고정 문구 — 참고용 고지 (갱신일은 상단 기준일 배너가 단일 출처) */}
        <div className="mt-8 border-t border-rule pt-5 text-center">
          <p className="text-xs text-ink-soft leading-relaxed">
            본 계산기는 참고용이며 법적 효력이 없습니다. 실제 신고·납부 세액은 홈택스,
            관할 세무서 또는 세무 전문가를 통해 반드시 확인하시기 바랍니다.
          </p>
        </div>
        </CalcNotes>
      </CalcSection>
    </>
  )
}
