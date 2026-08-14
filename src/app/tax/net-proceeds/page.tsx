/**
 * @파일: tax/net-proceeds/page.tsx
 * @설명: 매도 실수령액 계산기 — 아파트를 팔면 실제로 손에 쥐는 돈을 답하는 계산기.
 *        양도소득세·중개수수료는 기존 엔진으로 계산해 차감한다(재구현 없음).
 *        다른 계산기와 같은 원칙: 근거를 먼저 보여주고, 룰이 없으면 0원 대신 안내하며,
 *        판단 한계를 화면에 명시한다.
 *        테마·Navbar·Footer·계산기 전환 탭은 공유 레이아웃(tax/layout.tsx)이 담당한다.
 */

import type { Metadata } from 'next'
import { Wallet } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { TAX_CALCULATORS } from '@/lib/tax/calculators'
import ApartmentOnlyNotice from '../_components/ApartmentOnlyNotice'
import RuleBasisBanner from '../_components/RuleBasisBanner'
import NetProceedsForm from './NetProceedsForm'

export const dynamic = 'force-dynamic'

/** 이 계산기의 목록 항목 — 열림 여부(available)의 단일 출처는 calculators.ts */
const CALC_INFO = TAX_CALCULATORS.find((c) => c.slug === 'net-proceeds')

export const metadata: Metadata = {
  ...buildPageMetadata({
    path: '/tax/net-proceeds',
    title: '아파트 매도 실수령액 계산기 — 법령 근거 기반',
    description:
      '아파트를 팔면 실제로 손에 쥐는 돈을 계산합니다. 양도소득세·지방소득세·중개수수료·그 밖의 비용을 양도가액에서 차감한 실수령액을, 적용된 법령명·조문·시행일·원문 링크와 함께 보여드립니다.',
  }),
  // 준비 중(available:false)인 동안은 검색엔진 색인 금지 — 룰 미등록 안내 화면이 검색에
  // 잡히지 않게 한다. available:true로 열면 자동 해제 (다른 계산기와 같은 방식).
  ...(CALC_INFO?.available ? {} : { robots: { index: false, follow: false } }),
}

/** 오늘 날짜(한국 시간) YYYY-MM-DD — 룰 유효기간 판정용 */
function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

/**
 * @함수명: fetchGraceDeadlineText
 * @설명: 오늘 기준 유효한 다주택 중과 룰(transfer.heavy)에서 경과조치 계약 마감일을 읽어
 *        안내 문구용 한국어 날짜로 반환합니다. 룰이 없거나 값이 없으면 null.
 *        (양도세 페이지의 동일 함수와 같은 로직 — 파일 분리로 인한 소형 중복)
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

export default async function NetProceedsPage() {
  const graceDeadlineText = await fetchGraceDeadlineText()

  return (
    <>
      {/* Hero */}
      <section className="pt-8 sm:pt-10 pb-4 px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-pen/10 border border-pen/20 mb-6">
          <Wallet size={26} className="text-pen" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-black text-ink mb-3">
          매도 실수령액 계산기
        </h1>
        <p className="text-ink-soft text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          아파트를 팔면 실제로 손에 쥐는 돈이 얼마인지 답합니다. 양도소득세와 중개수수료는
          이미 검증된 계산기가 그대로 계산하고, 양도가액에서 무엇이 얼마씩 빠지는지
          단계별로 보여드립니다.
        </p>
      </section>

      {/* 계산기 */}
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <RuleBasisBanner taxTypes={['transfer', 'brokerage', 'common']} />
        <ApartmentOnlyNotice />
        <NetProceedsForm graceDeadlineText={graceDeadlineText} />

        {/* 판단 한계 안내 — 이 계산기가 반영하지 못하는 것들 명시 */}
        <div className="mt-8 bg-paper-raised border border-rule rounded-lg p-5">
          <p className="text-sm font-semibold text-ink mb-2">계산 전에 확인하세요</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-soft leading-relaxed">
            <li>
              양도소득세 계산기의 판단 한계가 그대로 적용됩니다 — 상속주택 특례(보유기간
              기산 외), 동거봉양·혼인 합가, 상생임대주택, 고령자 감면, 등록임대주택 특례는
              반영되지 않으며, &lsquo;취득 당시&rsquo; 조정대상지역 여부는 직접 선택해야
              합니다.
            </li>
            <li>
              중개보수 요율은 중개사무소 소재지의 시·도 조례를 따르는데, 이 계산기는 물건
              소재지로 갈음합니다. 다른 시·도의 중개사무소를 통해 거래하면 상한이 다를 수
              있습니다.
            </li>
            <li>
              중개수수료는 법정 상한일 뿐 실제 금액은 협의로 정해집니다 — 실제 지급액을
              입력하면 그 값으로 계산합니다.
            </li>
            <li>대출 상환·전세보증금 반환 등 돌려주거나 갚는 돈은 포함되지 않습니다.</li>
            <li>확정되지 않은 개편안은 반영하지 않습니다.</li>
          </ul>
        </div>

        {/* 하단 고정 문구 — 참고용 고지 (갱신일은 상단 기준일 배너가 단일 출처) */}
        <div className="mt-8 border-t border-rule pt-5 text-center">
          <p className="text-xs text-ink-soft leading-relaxed">
            본 계산기는 참고용이며 법적 효력이 없습니다. 실제 세액·수수료는 홈택스,
            관할 세무서, 중개사 또는 세무 전문가를 통해 반드시 확인하시기 바랍니다.
          </p>
        </div>
      </section>
    </>
  )
}
