/**
 * @파일: tax/transfer/page.tsx
 * @설명: 부동산 양도소득세 계산기 — 이 서비스에서 가장 중요한 계산기이자 잘못된 정보가
 *        가장 많이 도는 분야. 다른 계산기와 같은 원칙: 근거를 먼저 보여주고, 룰이 없으면
 *        0원 대신 안내하며, 판단 한계(제외한 특례들)를 화면에 명시한다.
 *        테마·Navbar·Footer·계산기 전환 탭은 공유 레이아웃(tax/layout.tsx)이 담당한다.
 */

import type { Metadata } from 'next'
import { Building } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { TAX_CALCULATORS } from '@/lib/tax/calculators'
import ApartmentOnlyNotice from '../_components/ApartmentOnlyNotice'
import TransferForm from './TransferForm'

export const dynamic = 'force-dynamic'

/** 이 계산기의 목록 항목 — 열림 여부(available)의 단일 출처는 calculators.ts */
const CALC_INFO = TAX_CALCULATORS.find((c) => c.slug === 'transfer')

export const metadata: Metadata = {
  ...buildPageMetadata({
    path: '/tax/transfer',
    title: '부동산 양도소득세 계산기 — 법령 근거 기반',
    description:
      '아파트 양도소득세를 법령 근거와 함께 계산합니다. 1세대 1주택 비과세·고가주택 안분·장기보유특별공제 두 표·다주택 중과와 경과조치·지방소득세까지, 적용된 법령명·조문·시행일·원문 링크를 결과에 그대로 표시합니다.',
  }),
  // 준비 중(available:false)인 동안은 검색엔진 색인 금지 — 룰 미등록 안내 화면이 검색에
  // 잡히지 않게 한다. available:true로 열면 자동 해제 (중개수수료와 같은 방식).
  ...(CALC_INFO?.available ? {} : { robots: { index: false, follow: false } }),
}

/**
 * @함수명: fetchLastRuleUpdatedAt
 * @설명: 양도소득세 룰의 마지막 갱신 일시를 조회합니다(하단 고지용). 룰이 없으면 null.
 */
async function fetchLastRuleUpdatedAt(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tax_rules')
    .select('updated_at')
    .eq('tax_type', 'transfer')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error) {
    console.error('[tax] 양도소득세 룰 갱신일 조회 실패:', error.message)
    return null
  }
  return data?.[0]?.updated_at ?? null
}

/** 타임스탬프를 한국 시간 날짜 문자열로 변환 */
function formatKstDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'long',
    timeZone: 'Asia/Seoul',
  }).format(new Date(iso))
}

export default async function TransferTaxPage() {
  const lastUpdatedAt = await fetchLastRuleUpdatedAt()

  return (
    <>
      {/* Hero */}
      <section className="pt-8 sm:pt-10 pb-4 px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-pen/10 border border-pen/20 mb-6">
          <Building size={26} className="text-pen" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-black text-ink mb-3">
          부동산 양도소득세 계산기
        </h1>
        <p className="text-ink-soft text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          아파트를 팔 때 내는 양도소득세를 계산합니다. 비과세·고가주택·장기보유특별공제·
          다주택 중과가 어느 법 몇 조로 어떻게 적용됐는지, 계산 과정 전체를 근거와 함께
          보여드립니다. 세금 없음도 이유와 함께 답합니다.
        </p>
      </section>

      {/* 계산기 */}
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <ApartmentOnlyNotice />
        <TransferForm />

        {/* 판단 한계 안내 — 이 계산기가 반영하지 못하는 것들(제외 특례 명시) */}
        <div className="mt-8 bg-paper-raised border border-rule rounded-lg p-5">
          <p className="text-sm font-semibold text-ink mb-2">계산 전에 확인하세요</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-soft leading-relaxed">
            <li>
              다음 특례는 반영되지 않습니다: 상속주택 특례(보유기간 기산 외의 특례),
              동거봉양·혼인 합가 특례, 상생임대주택, 고령자 감면, 등록임대주택 관련 특례.
              해당된다면 실제 세액이 달라질 수 있으니 세무 전문가와 확인하세요.
            </li>
            <li>
              &lsquo;취득 당시&rsquo; 조정대상지역 여부는 과거 이력이 시스템에 없어 직접
              선택해야 합니다(비과세 거주 요건 판정용). &lsquo;양도 당시&rsquo; 여부는
              등록된 이력으로 자동 판정합니다.
            </li>
            <li>
              거주기간 산정의 초일 산입 방식은 법령·집행기준에서 확인되지 않았습니다.
              보유기간과 같은 방식을 전제로 하며, 요건 연수 경계에 걸리면 관할 세무서에
              확인하세요.
            </li>
            <li>필요경비를 비우면 0으로 계산합니다 — 실제 세금은 이보다 낮을 수 있습니다.</li>
            <li>확정되지 않은 개편안은 반영하지 않습니다.</li>
          </ul>
        </div>

        {/* 하단 고정 문구 — 참고용 고지 + 마지막 룰 갱신일 */}
        <div className="mt-8 border-t border-rule pt-5 text-center space-y-1.5">
          <p className="text-xs text-ink-soft leading-relaxed">
            본 계산기는 참고용이며 법적 효력이 없습니다. 실제 신고·납부 세액은 홈택스,
            관할 세무서 또는 세무 전문가를 통해 반드시 확인하시기 바랍니다.
          </p>
          <p className="text-xs text-ink-faint">
            {lastUpdatedAt
              ? `마지막 룰 갱신일: ${formatKstDate(lastUpdatedAt)}`
              : '아직 등록된 양도소득세 룰이 없습니다. 룰 등록 전에는 계산이 제공되지 않습니다.'}
          </p>
        </div>
      </section>
    </>
  )
}
