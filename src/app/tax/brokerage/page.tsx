/**
 * @파일: tax/brokerage/page.tsx
 * @설명: 부동산 중개수수료(중개보수) 상한 계산기 — 세금이 아니라 법정 '상한'을 계산한다.
 *        결과가 상한액임과 실제 금액은 협의로 정한다는 사실이 이 화면의 핵심 메시지다.
 *        취득세·인지세와 같은 원칙: 근거를 먼저 보여주고, 룰이 없으면 0원 대신 안내한다.
 *        테마·Navbar·Footer·계산기 전환 탭은 공유 레이아웃(tax/layout.tsx)이 담당한다.
 */

import type { Metadata } from 'next'
import { Handshake } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import ApartmentOnlyNotice from '../_components/ApartmentOnlyNotice'
import BrokerageForm from './BrokerageForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildPageMetadata({
  path: '/tax/brokerage',
  title: '부동산 중개수수료 상한 계산기 — 법령 근거 기반',
  description:
    '부동산 매매·교환·임대차의 중개보수 법정 상한액을 계산합니다. 실제 중개보수는 상한 안에서 협의로 정해지며, 적용된 법령명·조문·시행일·원문 링크를 결과에 그대로 표시합니다.',
})

/**
 * @함수명: fetchLastRuleUpdatedAt
 * @설명: 중개수수료 룰의 마지막 갱신 일시를 조회합니다(하단 고지용). 룰이 없으면 null.
 */
async function fetchLastRuleUpdatedAt(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tax_rules')
    .select('updated_at')
    .eq('tax_type', 'brokerage')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error) {
    console.error('[tax] 중개수수료 룰 갱신일 조회 실패:', error.message)
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

export default async function BrokeragePage() {
  const lastUpdatedAt = await fetchLastRuleUpdatedAt()

  return (
    <>
      {/* Hero */}
      <section className="pt-8 sm:pt-10 pb-4 px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-pen/10 border border-pen/20 mb-6">
          <Handshake size={26} className="text-pen" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-black text-ink mb-3">
          부동산 중개수수료 상한 계산기
        </h1>
        <p className="text-ink-soft text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          중개보수는 국가가 금액을 정해 주는 것이 아니라 &ldquo;넘을 수 없는 상한&rdquo;만
          정해져 있습니다. 이 계산기는 그 법정 상한액을 계산하고, 어느 법령·조례 근거가
          적용됐는지 결과와 함께 보여드립니다. 실제 금액은 상한 안에서 협의로 정합니다.
        </p>
      </section>

      {/* 계산기 */}
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <ApartmentOnlyNotice />
        <BrokerageForm />

        {/* 판단 한계 안내 — 이 계산기가 반영하지 못하는 것들 */}
        <div className="mt-8 bg-paper-raised border border-rule rounded-lg p-5">
          <p className="text-sm font-semibold text-ink mb-2">계산 전에 확인하세요</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-soft leading-relaxed">
            <li>
              결과는 법정 <strong className="text-ink">상한액</strong>입니다. 실제 중개보수는
              상한을 넘지 않는 범위에서 의뢰인과 개업공인중개사가 협의하여 정합니다.
            </li>
            <li>
              이 계산기는 아파트를 기준으로 합니다. 오피스텔·상가·토지는 요율 체계가
              달라 결과가 맞지 않습니다.
            </li>
            <li>
              상한 요율·한도액을 정하는 시·도 조례는 물건 소재지가 아니라{' '}
              <strong className="text-ink">중개사무소 소재지</strong> 기준으로 적용됩니다.
              지역·시기에 따라 값이 다를 수 있습니다.
            </li>
            <li>
              요율표의 금액에 부가가치세가 포함되는지는 법령에 명시가 없어 실제 거래 시
              확인이 필요합니다. 이 계산기는 부가가치세를 별도 항목으로 표시하며,
              개업공인중개사의 과세 유형(일반과세·간이과세)에 따라 적용 방식이 다릅니다.
            </li>
          </ul>
        </div>

        {/* 하단 고정 문구 — 참고용 고지 + 마지막 룰 갱신일 */}
        <div className="mt-8 border-t border-rule pt-5 text-center space-y-1.5">
          <p className="text-xs text-ink-soft leading-relaxed">
            본 계산기는 참고용이며 법적 효력이 없습니다. 실제 중개보수는 소재지 시·도
            조례와 중개대상물 확인·설명서, 개업공인중개사와의 협의를 통해 반드시
            확인하시기 바랍니다.
          </p>
          <p className="text-xs text-ink-faint">
            {lastUpdatedAt
              ? `마지막 룰 갱신일: ${formatKstDate(lastUpdatedAt)}`
              : '아직 등록된 중개수수료 룰이 없습니다. 룰 등록 전에는 계산이 제공되지 않습니다.'}
          </p>
        </div>
      </section>
    </>
  )
}
