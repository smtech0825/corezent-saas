/**
 * @컴포넌트: HowItWorksSection
 * @설명: 구매 및 사용 흐름 단계 설명 섹션 — DB 데이터 우선, 없으면 기본값 사용
 */

import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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
    title: 'Choose your software',
    description:
      'Browse our product lineup and pick the tool that fits your needs. Simple, transparent pricing — monthly or annual.',
  },
  {
    id: 'default-2',
    number: '02',
    icon: 'Zap',
    title: 'Instant access & activation',
    description:
      'Complete your purchase and get immediate access. Your license is activated instantly — no waiting, no hassle.',
  },
  {
    id: 'default-3',
    number: '03',
    icon: 'Headphones',
    title: 'Use it with full support',
    description:
      'Get started with our detailed manuals and dedicated support. We are here to help you get the most out of every product.',
  },
]

function getIcon(name: string | null): LucideIcon {
  if (!name) return LucideIcons.Zap as LucideIcon
  const icon = (LucideIcons as Record<string, unknown>)[name]
  return (typeof icon === 'function' ? icon : LucideIcons.Zap) as LucideIcon
}

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
            How it works
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Simple from start to finish.
          </h2>
          <p className="text-[#94A3B8] text-lg max-w-xl mx-auto">
            No complicated setup. No hidden steps. Just pick, purchase, and start
            using your software right away.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((step, idx) => {
            const Icon = getIcon(step.icon)
            return (
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
                  <Icon size={24} className="text-[#38BDF8]" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-[#94A3B8] text-sm leading-relaxed">{step.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
