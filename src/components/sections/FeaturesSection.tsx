/**
 * @컴포넌트: FeaturesSection
 * @설명: CoreZent 플랫폼 핵심 특징 벤토 그리드 섹션 — DB 데이터 우선, 없으면 기본값 사용
 */

import DynamicIcon from '@/components/DynamicIcon'

export interface DbFeature {
  id: string
  icon: string | null
  tag: string | null
  title: string
  description: string
}

interface Props {
  features?: DbFeature[]
}

const defaultFeatures = [
  {
    id: 'default-1',
    icon: 'Code2',
    tag: '자체 개발',
    title: '개발자가 사용자를 위해 직접 제작',
    description:
      '모든 제품은 외주가 아닌 자체 팀이 직접 만들고 관리합니다. 우리가 파는 것을 우리가 직접 쓰기 때문에 품질이 언제나 최우선입니다.',
  },
  {
    id: 'default-2',
    icon: 'Zap',
    tag: '즉시',
    title: '몇 초 만에 라이선스 활성화',
    description:
      '결제하면 즉시 사용할 수 있습니다. 라이선스가 곧바로 발급·활성화되어 대기 시간이 없습니다.',
  },
  {
    id: 'default-3',
    icon: 'BookOpen',
    tag: '문서',
    title: '상세한 매뉴얼 & 가이드',
    description:
      '모든 제품에는 빠르게 시작할 수 있도록 포괄적인 문서, 튜토리얼, 단계별 가이드가 함께 제공됩니다.',
  },
  {
    id: 'default-4',
    icon: 'CreditCard',
    tag: '요금제',
    title: '유연한 플랜, 예상치 못한 비용 없음',
    description:
      '월간 또는 연간 결제를 선택하세요. 명확한 요금, 숨겨진 비용 없음, 언제든 간편하게 해지할 수 있습니다.',
  },
  {
    id: 'default-5',
    icon: 'Shield',
    tag: '보안',
    title: '안전한 결제 & 데이터 보호',
    description:
      '안전한 결제, 암호화된 라이선스 키, 그리고 여러분의 데이터는 절대 제3자와 공유하거나 판매하지 않습니다.',
  },
  {
    id: 'default-6',
    icon: 'Headphones',
    tag: '지원',
    title: '사람이 직접 응대하는 지원',
    description:
      '제품을 만든 개발자에게 직접 도움을 받으세요. 빠르고, 정확하며, 정말로 도움이 됩니다.',
  },
]

export default function FeaturesSection({ features }: Props) {
  const items =
    features && features.length > 0
      ? features.map((f) => ({ id: f.id, icon: f.icon, tag: f.tag ?? '', title: f.title, description: f.description }))
      : defaultFeatures

  return (
    <section id="features" className="relative py-32 px-6">
      {/* Bottom glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(56,189,248,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[#38BDF8] text-sm font-semibold tracking-widest uppercase mb-4">
            CoreZent를 선택하는 이유
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            믿을 수 있는 소프트웨어
          </h2>
          <p className="text-[#94A3B8] text-lg max-w-xl mx-auto">
            우리는 출시하는 모든 제품에 자부심을 갖습니다 — 정성껏 만들고,
            책임감 있게 지원합니다.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((feature) => (
            <div
              key={feature.id}
              className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6 hover:border-[#38BDF8]/20 hover:bg-[#0F1929] transition-all duration-300 group"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#0B1120] border border-[#1E293B] flex items-center justify-center group-hover:border-[#38BDF8]/25 transition-colors">
                  <DynamicIcon name={feature.icon ?? 'Zap'} size={18} className="text-[#38BDF8]" />
                </div>
                {feature.tag && (
                  <span className="text-xs text-[#475569] font-mono uppercase tracking-wider">
                    {feature.tag}
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
