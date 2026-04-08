/**
 * @컴포넌트: FeaturesSection
 * @설명: CoreZent 플랫폼 핵심 특징 벤토 그리드 섹션 — DB 데이터 우선, 없으면 기본값 사용
 */

import DynamicIcon from '@/components/DynamicIcon'

export interface DbFeature {
  id: string
  icon: string | null
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
    tag: 'Built in-house',
    title: 'Made by developers, for users',
    description:
      'Every product is built and maintained by our own team — not outsourced. We use what we sell, so quality is always our priority.',
  },
  {
    id: 'default-2',
    icon: 'Zap',
    tag: 'Instant',
    title: 'License activated in seconds',
    description:
      'Purchase and get immediate access. Your license is delivered and activated instantly — no waiting period.',
  },
  {
    id: 'default-3',
    icon: 'BookOpen',
    tag: 'Docs',
    title: 'Detailed manuals & guides',
    description:
      'Every product comes with comprehensive documentation, tutorials, and step-by-step guides to get you started fast.',
  },
  {
    id: 'default-4',
    icon: 'CreditCard',
    tag: 'Pricing',
    title: 'Flexible plans, no surprises',
    description:
      'Choose monthly or annual billing. Clear pricing, no hidden fees, and easy cancellation at any time.',
  },
  {
    id: 'default-5',
    icon: 'Shield',
    tag: 'Secure',
    title: 'Safe purchase & data protection',
    description:
      'Secure checkout, encrypted license keys, and your data is never shared or sold to third parties.',
  },
  {
    id: 'default-6',
    icon: 'Headphones',
    tag: 'Support',
    title: 'Real support from real people',
    description:
      'Get help directly from the developers who built the product. Fast, knowledgeable, and actually useful.',
  },
]

export default function FeaturesSection({ features }: Props) {
  const items =
    features && features.length > 0
      ? features.map((f) => ({ id: f.id, icon: f.icon, tag: '', title: f.title, description: f.description }))
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
            Why CoreZent
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Software you can trust.
          </h2>
          <p className="text-[#94A3B8] text-lg max-w-xl mx-auto">
            We take pride in every product we ship — built with care, supported
            with commitment.
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
