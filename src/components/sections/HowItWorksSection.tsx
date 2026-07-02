/**
 * @컴포넌트: HowItWorksSection
 * @설명: 도입 절차 — 공문 표(表) 스타일. 순서·단계·내용 3열.
 *        DB(front_steps) 데이터 우선, 없으면 GenieWork 기본값.
 */

import Section, { SectionHeader } from '@/components/ui/Section'

export interface DbStep {
  id: string
  icon: string | null
  title: string
  description: string | null
}

interface Props {
  steps?: DbStep[]
}

const defaultSteps: DbStep[] = [
  { id: 'default-1', icon: null, title: '다운로드', description: 'corezent.com에서 설치 파일을 내려받습니다.' },
  { id: 'default-2', icon: null, title: '설치', description: '담당자 PC에 설치합니다.' },
  { id: 'default-3', icon: null, title: '라이선스 인증', description: '구매 후 발급된 키를 입력하면 해당 PC가 자동 등록됩니다.' },
  { id: 'default-4', icon: null, title: '사용 시작', description: '문서 작성·검색을 바로 사용합니다. PC 교체 시 대시보드에서 재인증합니다.' },
]

export default function HowItWorksSection({ steps }: Props) {
  const items = steps && steps.length > 0 ? steps : defaultSteps

  return (
    <Section id="how-it-works">
      <SectionHeader label="도입 절차" title="다운로드에서 사용까지, 네 단계" />

      <div className="overflow-x-auto max-w-3xl mx-auto">
        <table className="w-full border-collapse text-sm sm:text-base">
          <thead>
            <tr>
              <th className="border border-ink bg-paper-shade px-3 py-2.5 text-center font-sans font-bold text-[13px] tracking-wider w-14">순서</th>
              <th className="border border-ink bg-paper-shade px-4 py-2.5 text-left font-sans font-bold text-[13px] tracking-wider w-36">단계</th>
              <th className="border border-ink bg-paper-shade px-4 py-2.5 text-left font-sans font-bold text-[13px] tracking-wider">내용</th>
            </tr>
          </thead>
          <tbody>
            {items.map((step, idx) => (
              <tr key={step.id}>
                <td className="border border-ink px-3 py-3 text-center font-mono font-semibold text-ink">{idx + 1}</td>
                <td className="border border-ink px-4 py-3 font-serif font-bold text-ink">{step.title}</td>
                <td className="border border-ink px-4 py-3 text-ink-soft break-keep">{step.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
