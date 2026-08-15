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
import CalcSection, { CalcNotes } from '../_components/CalcSection'
import { fetchAutoRegulatedEnabled } from '../_components/coverage-rule'
import RuleBasisBanner from '../_components/RuleBasisBanner'
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

/** 오늘 날짜(한국 시간) YYYY-MM-DD — 룰 유효기간 판정용 */
function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

/**
 * @함수명: fetchGraceDeadlineText
 * @설명: 오늘 기준 유효한 다주택 중과 룰(transfer.heavy)에서 경과조치 계약 마감일을 읽어
 *        안내 문구용 한국어 날짜로 반환합니다. 룰이 없거나 값이 없으면 null —
 *        폼은 날짜 없는 일반 문구를 표시합니다(마감일의 단일 출처는 룰).
 */
async function fetchGraceDeadlineText(): Promise<string | null> {
  const supabase = await createClient()
  const today = todayKst()
  const { data, error } = await supabase
    .from('tax_rules')
    .select('rule_value')
    .eq('tax_type', 'transfer')
    .eq('rule_key', 'transfer.heavy')
    .eq('status', 'confirmed')
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })
    .limit(1)
  if (error) {
    console.error('[tax] 경과조치 마감일 조회 실패:', error.message)
    return null
  }
  const value = data?.[0]?.rule_value as { grace?: { contractDeadline?: string } } | undefined
  const deadline = value?.grace?.contractDeadline
  if (typeof deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null
  const [y, m, d] = deadline.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

export default async function TransferTaxPage() {
  const [graceDeadlineText, autoRegulatedEnabled] = await Promise.all([
    fetchGraceDeadlineText(),
    fetchAutoRegulatedEnabled(),
  ])

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
      <CalcSection>
        <RuleBasisBanner taxTypes={['transfer', 'common']} />
        <ApartmentOnlyNotice />
        <TransferForm graceDeadlineText={graceDeadlineText} autoRegulatedEnabled={autoRegulatedEnabled} />

        <CalcNotes>
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
              &lsquo;취득 당시&rsquo;·&lsquo;양도 당시&rsquo; 조정대상지역 여부는 등록된 지정
              이력으로 자동 판정하고 근거(지정일·공고)를 함께 보여드립니다. 이력이 갖춰지지
              않은 시점이거나 시·군·구 일부만 지정된 곳이면 자동으로 판정하지 않고 이유와 함께
              직접 선택을 요청합니다 — 직접 선택한 값이 자동 판정보다 우선합니다.
            </li>
            <li>
              거주기간 산정의 초일 산입 방식은 법령·집행기준에서 확인되지 않았습니다.
              보유기간과 같은 방식을 전제로 하며, 요건 연수 경계에 걸리면 관할 세무서에
              확인하세요.
            </li>
            <li>필요경비를 비우면 0으로 계산합니다 — 실제 세금은 이보다 낮을 수 있습니다.</li>
            <li>
              장기보유특별공제에 금액 한도가 적용되는 경우(개편안 기준), 같은 해에 여러
              물건을 양도하면 인별 합산 한도가 별도로 적용되지만 이 계산기는 해당 물건
              기준으로만 계산합니다.
            </li>
            <li>
              기본값(확정된 법 기준)에는 확정되지 않은 개편안이 반영되지 않습니다.
              &lsquo;개정안 포함&rsquo;을 선택하면 국회 통과 전 개편안 룰을 포함해 참고용으로
              계산하며, 항목별 시행 시점(2027·2028·2029년)에 따라 양도일 기준으로 적용됩니다.
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
