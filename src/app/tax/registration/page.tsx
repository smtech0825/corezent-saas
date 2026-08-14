/**
 * @파일: tax/registration/page.tsx
 * @설명: 등기비용 계산기(아파트 매매 소유권 이전) — "무엇이 얼마씩 나가는지"를 항목별로
 *        보여주는 계산기. 취득세·인지세는 기존 엔진으로 계산해 합산한다(재구현 없음).
 *        다른 계산기와 같은 원칙: 근거를 먼저 보여주고, 룰이 없으면 0원 대신 안내하며,
 *        판단 한계를 화면에 명시한다.
 *        테마·Navbar·Footer·계산기 전환 탭은 공유 레이아웃(tax/layout.tsx)이 담당한다.
 */

import type { Metadata } from 'next'
import { FileSignature } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo'
import { TAX_CALCULATORS } from '@/lib/tax/calculators'
import ApartmentOnlyNotice from '../_components/ApartmentOnlyNotice'
import RuleBasisBanner from '../_components/RuleBasisBanner'
import RegistrationForm from './RegistrationForm'

export const dynamic = 'force-dynamic'

/** 이 계산기의 목록 항목 — 열림 여부(available)의 단일 출처는 calculators.ts */
const CALC_INFO = TAX_CALCULATORS.find((c) => c.slug === 'registration')

export const metadata: Metadata = {
  ...buildPageMetadata({
    path: '/tax/registration',
    title: '부동산 등기비용 계산기 — 법령 근거 기반',
    description:
      '아파트 매매 소유권 이전 등기에 드는 비용을 항목별로 계산합니다. 취득세·지방교육세·농어촌특별세·인지세·등기신청 수수료·국민주택채권 손실액·법무사 보수까지, 무엇이 얼마씩 나가는지 적용 법령 근거와 함께 보여드립니다.',
  }),
  // 준비 중(available:false)인 동안은 검색엔진 색인 금지 — 룰 미등록 안내 화면이 검색에
  // 잡히지 않게 한다. available:true로 열면 자동 해제 (다른 계산기와 같은 방식).
  ...(CALC_INFO?.available ? {} : { robots: { index: false, follow: false } }),
}

export default function RegistrationCostPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-8 sm:pt-10 pb-4 px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-pen/10 border border-pen/20 mb-6">
          <FileSignature size={26} className="text-pen" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-black text-ink mb-3">
          부동산 등기비용 계산기
        </h1>
        <p className="text-ink-soft text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          아파트를 사고 소유권 이전 등기를 할 때 실제로 나가는 돈을 항목별로 계산합니다.
          취득세와 인지세는 이미 검증된 계산기가 그대로 계산하고, 등기신청 수수료·
          국민주택채권 손실액·법무사 보수까지 한 번에 봅니다.
        </p>
      </section>

      {/* 계산기 */}
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <RuleBasisBanner taxTypes={['registration', 'acquisition', 'stamp', 'common']} />
        <ApartmentOnlyNotice />
        <RegistrationForm />

        {/* 판단 한계 안내 — 이 계산기가 반영하지 못하는 것들 명시 */}
        <div className="mt-8 bg-paper-raised border border-rule rounded-lg p-5">
          <p className="text-sm font-semibold text-ink mb-2">계산 전에 확인하세요</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-soft leading-relaxed">
            <li>
              법무사 보수는 자율 협의라 정해진 값이 없습니다 — 견적받은 금액을 입력해야
              총액에 포함되며, 비우면 그 사실이 결과에 표시됩니다.
            </li>
            <li>
              국민주택채권 즉시매도 손실률은 금리에 따라 매일 바뀝니다 — 주택도시기금
              포털의 당일 고객부담금 조회에서 확인해 입력하세요. 비우면 채권 항목이
              계산에서 빠져 실제 지출이 결과보다 클 수 있습니다.
            </li>
            <li>대출 관련 비용과 근저당 설정 등기는 포함되지 않습니다.</li>
            <li>상속·증여·신축 등기는 대상이 아닙니다 — 아파트 매매 등기 전용입니다.</li>
            <li>공시가격은 국민주택채권 매입액 계산의 기준이라 반드시 입력해야 합니다.</li>
            <li>확정되지 않은 개편안은 반영하지 않습니다.</li>
          </ul>
        </div>

        {/* 하단 고정 문구 — 참고용 고지 (갱신일은 상단 기준일 배너가 단일 출처) */}
        <div className="mt-8 border-t border-rule pt-5 text-center">
          <p className="text-xs text-ink-soft leading-relaxed">
            본 계산기는 참고용이며 법적 효력이 없습니다. 실제 비용은 위택스, 등기소,
            법무사 또는 세무 전문가를 통해 반드시 확인하시기 바랍니다.
          </p>
        </div>
      </section>
    </>
  )
}
