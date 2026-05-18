/**
 * @컴포넌트: HowItWorksSection
 * @설명: 구매 및 사용 흐름 단계 설명 섹션 — DB 데이터 우선, 없으면 기본값 사용
 */

import DynamicIcon from '@/components/DynamicIcon'

export interface DbStep {
  id: string
  icon: string | null
  title: string
  description: string | null
}

interface Props {
  steps?: DbStep[]
}

const defaultSteps: (DbStep & { number: string })[] = [
  {
    id: 'default-1',
    number: '01',
    icon: 'ShoppingCart',
    title: '소프트웨어를 선택하세요',
    description:
      '제품 라인업을 둘러보고 필요에 맞는 도구를 고르세요. 월간·연간 중 선택할 수 있는 간단하고 투명한 요금제입니다.',
  },
  {
    id: 'default-2',
    number: '02',
    icon: 'Zap',
    title: '즉시 접근 & 활성화',
    description:
      '결제를 완료하면 바로 사용할 수 있습니다. 라이선스가 즉시 활성화되어 기다림도, 번거로움도 없습니다.',
  },
  {
    id: 'default-3',
    number: '03',
    icon: 'Headphones',
    title: '완벽한 지원과 함께 사용하세요',
    description:
      '상세한 매뉴얼과 전담 지원으로 시작하세요. 모든 제품을 최대한 활용하실 수 있도록 도와드립니다.',
  },
]

export default function HowItWorksSection({ steps }: Props) {
  const items =
    steps && steps.length > 0
      ? steps.map((s, i) => ({
          ...s,
          number: String(i + 1).padStart(2, '0'),
        }))
      : defaultSteps

  return (
    <section id="how-it-works" className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <p className="text-[#38BDF8] text-sm font-semibold tracking-widest uppercase mb-4">
            이용 방법
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            처음부터 끝까지 간단하게
          </h2>
          <p className="text-[#94A3B8] text-lg max-w-xl mx-auto">
            복잡한 설정도, 숨겨진 절차도 없습니다. 고르고, 결제하고, 바로
            소프트웨어를 사용하세요.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((step, idx) => (
            <div
              key={step.id}
              className="relative flex flex-col items-center text-center p-8 border border-[#1E293B] bg-[#111A2E] rounded-2xl hover:border-[#38BDF8]/20 transition-all duration-300 group"
            >
              {/* Connector arrow (desktop only) */}
              {idx < items.length - 1 && (
                <div className="hidden md:flex absolute top-14 -right-4 z-10 w-8 h-8 items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M4 10h12M11 5l5 5-5 5"
                      stroke="#1E293B"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}

              {/* Step number */}
              <span className="text-xs font-mono text-[#38BDF8]/40 mb-4 font-bold tracking-widest">
                {step.number}
              </span>

              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center mb-6 group-hover:bg-[#38BDF8]/15 transition-colors">
                <DynamicIcon name={step.icon ?? 'Zap'} size={24} className="text-[#38BDF8]" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
              <p className="text-[#94A3B8] text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
