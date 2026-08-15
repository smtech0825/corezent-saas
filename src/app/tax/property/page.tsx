/**
 * @파일: tax/property/page.tsx
 * @설명: 부동산 재산세 계산기(주택분·연간 총액) — 다른 계산기와 같은 원칙:
 *        근거를 먼저 보여주고, 룰이 없으면 0원 대신 안내하며, 판단 한계를 화면에 명시한다.
 *        테마·Navbar·Footer·계산기 전환 탭은 공유 레이아웃(tax/layout.tsx)이 담당한다.
 */

import type { Metadata } from 'next'
import { Landmark } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo'
import { TAX_CALCULATORS } from '@/lib/tax/calculators'
import ApartmentOnlyNotice from '../_components/ApartmentOnlyNotice'
import CalcSection, { CalcNotes } from '../_components/CalcSection'
import RuleBasisBanner from '../_components/RuleBasisBanner'
import PropertyForm from './PropertyForm'

export const dynamic = 'force-dynamic'

/** 이 계산기의 목록 항목 — 열림 여부(available)의 단일 출처는 calculators.ts */
const CALC_INFO = TAX_CALCULATORS.find((c) => c.slug === 'property')

export const metadata: Metadata = {
  ...buildPageMetadata({
    path: '/tax/property',
    title: '부동산 재산세 계산기 — 법령 근거 기반',
    description:
      '아파트 재산세를 법령 근거와 함께 계산합니다. 공정시장가액비율과 1세대 1주택 특례, 과세표준·세부담 상한, 지방교육세·도시지역분까지, 적용된 법령명·조문·시행일·원문 링크를 결과에 그대로 표시합니다.',
  }),
  // 준비 중(available:false)인 동안은 검색엔진 색인 금지 — 룰 미등록 안내 화면이 검색에
  // 잡히지 않게 한다. available:true로 열면 자동 해제 (다른 계산기와 같은 방식).
  ...(CALC_INFO?.available ? {} : { robots: { index: false, follow: false } }),
}

export default function PropertyTaxPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-8 sm:pt-10 pb-4 px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-pen/10 border border-pen/20 mb-6">
          <Landmark size={26} className="text-pen" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-black text-ink mb-3">
          부동산 재산세 계산기
        </h1>
        <p className="text-ink-soft text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          아파트를 보유할 때 매년 내는 재산세를 계산합니다. 공정시장가액비율과 1세대 1주택
          특례, 상한 제도가 어느 법 몇 조로 어떻게 적용됐는지, 계산 과정 전체를 근거와 함께
          보여드립니다.
        </p>
      </section>

      {/* 계산기 */}
      <CalcSection>
        <RuleBasisBanner taxTypes={['property']} />
        <ApartmentOnlyNotice />
        <PropertyForm />

        <CalcNotes>
        {/* 판단 한계 안내 — 이 계산기가 반영하지 못하는 것들 명시 */}
        <div className="mt-8 bg-paper-raised border border-rule rounded-lg p-5">
          <p className="text-sm font-semibold text-ink mb-2">계산 전에 확인하세요</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-soft leading-relaxed">
            <li>
              지역자원시설세는 반영되지 않습니다 — 건물분만 따로 떼어낸 가액이 필요해 이
              계산기의 입력 범위를 벗어납니다. 실제 고지서에는 함께 붙을 수 있습니다.
            </li>
            <li>
              도시지역분은 지자체가 고시한 도시지역에만 붙습니다. 아파트는 대부분 해당하므로
              기본 포함하지만, 해당하지 않는 경우 고급 항목에서 제외할 수 있습니다. 지자체
              조례에 따른 세율 차이는 반영되지 않습니다.
            </li>
            <li>
              세부담 상한은 재산세 본세에 적용되며, 지방교육세는 상한이 적용된 본세를
              기준으로 계산됩니다. 도시지역분에는 상한이 반영되지 않습니다.
            </li>
            <li>
              직전 연도 과세표준·재산세액을 비우면 상한이 적용되지 않아 실제 고지서보다 높게
              나올 수 있습니다 — 상한은 세금을 낮추는 방향으로만 작동합니다.
            </li>
            <li>법인 소유 주택은 지원하지 않습니다.</li>
            <li>연간 총액 기준입니다 — 실제 고지는 회차를 나눠 이뤄질 수 있습니다.</li>
            <li>
              재산세는 2026년 세제개편안의 개정 대상이 아닙니다 — 개정 대상 법률에 재산세의
              근거 법률인 지방세법이 포함되지 않아, 이 계산기는 개정안 모드를 제공하지
              않습니다.
            </li>
          </ul>
        </div>

        {/* 하단 고정 문구 — 참고용 고지 (갱신일은 상단 기준일 배너가 단일 출처) */}
        <div className="mt-8 border-t border-rule pt-5 text-center">
          <p className="text-xs text-ink-soft leading-relaxed">
            본 계산기는 참고용이며 법적 효력이 없습니다. 실제 부과 세액은 위택스, 관할
            시·군·구청 또는 세무 전문가를 통해 반드시 확인하시기 바랍니다.
          </p>
        </div>
        </CalcNotes>
      </CalcSection>
    </>
  )
}
