/**
 * @컴포넌트: FeaturesSection
 * @설명: 핵심 특징 — 공문 "주요 기능" 항(項) 스타일. 가·나·다 표기 목록.
 *        DB(front_features) 데이터 우선, 없으면 GenieWork 기본값.
 */

import DynamicIcon from '@/components/DynamicIcon'
import Section, { SectionHeader } from '@/components/ui/Section'

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

const defaultFeatures: DbFeature[] = [
  {
    id: 'default-1',
    icon: 'FileText',
    tag: '작성',
    title: '초안 자동 작성',
    description:
      '제목과 개요만 입력하면 본문 생성 엔진이 형식을 갖춘 계획서·보고서·공문 초안을 작성합니다. 담당자는 검토와 수정에 집중하면 됩니다.',
  },
  {
    id: 'default-2',
    icon: 'Search',
    tag: '검색',
    title: '빠른 자료 검색',
    description:
      '홈 화면 검색으로 문서 작성에 필요한 근거와 표현을 바로 찾습니다. 경량 엔진이라 응답이 빠릅니다.',
  },
  {
    id: 'default-3',
    icon: 'ShieldCheck',
    tag: '보안',
    title: '설치형 보안',
    description:
      '문서 파일을 외부 서버에 올리지 않는 PC 설치형입니다. 감사와 개인정보 부담을 덜 수 있습니다.',
  },
  {
    id: 'default-4',
    icon: 'MonitorCheck',
    tag: '라이선스',
    title: 'PC 단위 라이선스',
    description:
      '라이선스 키 1개로 지정된 PC 수만큼 인증하며, PC 교체 시 재인증(reset)을 지원합니다.',
  },
]

/** 가나다라 항 표기 */
const HANGUL_ORDER = ['가', '나', '다', '라', '마', '바', '사', '아']

export default function FeaturesSection({ features }: Props) {
  const items = features && features.length > 0 ? features : defaultFeatures

  return (
    <Section id="features" tone="shade">
      <SectionHeader label="주요 기능" title="문서 업무를 이렇게 줄입니다" />

      <ol className="border-t border-rule">
        {items.map((feature, idx) => (
          <li
            key={feature.id}
            className="flex gap-4 sm:gap-6 border-b border-rule py-6 sm:py-7 items-start"
          >
            {/* 항 표기 */}
            <span className="font-serif font-black text-lg text-ink shrink-0 w-6 pt-1.5">
              {HANGUL_ORDER[idx] ? `${HANGUL_ORDER[idx]}.` : `${idx + 1}.`}
            </span>

            {/* 아이콘 */}
            <span className="w-11 h-11 rounded-md bg-paper-raised border border-rule flex items-center justify-center shrink-0">
              <DynamicIcon name={feature.icon ?? 'FileText'} size={20} className="text-pen" />
            </span>

            {/* 내용 */}
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                <h3 className="font-serif font-bold text-lg text-ink">{feature.title}</h3>
                {feature.tag && (
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                    {feature.tag}
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base text-ink-soft leading-relaxed break-keep">
                {feature.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}
