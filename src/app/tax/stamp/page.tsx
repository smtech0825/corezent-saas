/**
 * @파일: tax/stamp/page.tsx
 * @설명: 부동산 인지세 계산기 — 계약서(1통 기준) 기재금액 구간별 정액 세금.
 *        취득세와 같은 원칙: 세액보다 근거(어느 법 몇 조가 적용됐는지)를 먼저 보여주고,
 *        룰이 없으면 0원 대신 안내한다. 하단에 판단 한계 3가지 안내를 고정 표시한다.
 *        테마·Navbar·Footer·계산기 전환 탭은 공유 레이아웃(tax/layout.tsx)이 담당한다.
 */

import type { Metadata } from 'next'
import { Stamp } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import ApartmentOnlyNotice from '../_components/ApartmentOnlyNotice'
import RuleBasisBanner from '../_components/RuleBasisBanner'
import StampForm from './StampForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildPageMetadata({
  path: '/tax/stamp',
  title: '부동산 인지세 계산기 — 법령 근거 기반',
  description:
    '부동산 매매계약서에 붙는 인지세를 계약금액 기준으로 계산합니다. 적용된 법령명·조문·시행일·원문 링크를 결과에 그대로 표시하고, 비과세면 그 사유까지 보여드립니다.',
})

/**
 * @함수명: fetchLastRuleUpdatedAt
 * @설명: 인지세 룰의 마지막 갱신 일시를 조회합니다(하단 고지용). 룰이 없으면 null.
 */
async function fetchLastRuleUpdatedAt(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tax_rules')
    .select('updated_at')
    .eq('tax_type', 'stamp')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error) {
    console.error('[tax] 인지세 룰 갱신일 조회 실패:', error.message)
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

export default async function StampTaxPage() {
  const lastUpdatedAt = await fetchLastRuleUpdatedAt()

  return (
    <>
      {/* Hero */}
      <section className="pt-8 sm:pt-10 pb-4 px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-pen/10 border border-pen/20 mb-6">
          <Stamp size={26} className="text-pen" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-black text-ink mb-3">
          부동산 인지세 계산기
        </h1>
        <p className="text-ink-soft text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          부동산 계약서에 붙는 인지세를 계약금액 기준으로 계산합니다. 어느 법의 몇 조가,
          언제 시행된 것이 적용됐는지 결과와 함께 확인하세요. 비과세라면 왜 세금이
          없는지도 함께 보여드립니다.
        </p>
      </section>

      {/* 계산기 */}
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <RuleBasisBanner taxTypes={['stamp']} />
        <ApartmentOnlyNotice />
        <StampForm />

        {/* 판단 한계 안내 — 이 계산기가 반영하지 못하는 것들 */}
        <div className="mt-8 bg-paper-raised border border-rule rounded-lg p-5">
          <p className="text-sm font-semibold text-ink mb-2">계산 전에 확인하세요</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-ink-soft leading-relaxed">
            <li>
              인지세법에는 &ldquo;주택&rdquo;의 정의가 따로 없습니다. 오피스텔·복합 용도 건물 등
              주택 여부 판단이 어려운 경우에는 관할 세무서에 확인해야 합니다.
            </li>
            <li>
              이 계산은 계약서 1통 기준입니다. 계약서를 여러 통 작성하는 경우(통마다 각각
              과세)는 계산에 반영되지 않습니다.
            </li>
            <li>다른 법률에 따른 감면 특례는 반영되지 않습니다.</li>
          </ul>
        </div>

        {/* 하단 고정 문구 — 참고용 고지 + 마지막 룰 갱신일 */}
        <div className="mt-8 border-t border-rule pt-5 text-center space-y-1.5">
          <p className="text-xs text-ink-soft leading-relaxed">
            본 계산기는 참고용이며 법적 효력이 없습니다. 실제 납부 세액은 국세청,
            관할 세무서 또는 세무 전문가를 통해 반드시 확인하시기 바랍니다.
          </p>
          <p className="text-xs text-ink-faint">
            {lastUpdatedAt
              ? `마지막 룰 갱신일: ${formatKstDate(lastUpdatedAt)}`
              : '아직 등록된 인지세 룰이 없습니다. 룰 등록 전에는 계산이 제공되지 않습니다.'}
          </p>
        </div>
      </section>
    </>
  )
}
