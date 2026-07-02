/**
 * @컴포넌트: HeroSection
 * @설명: 랜딩 히어로 — "페이지 = 한 장의 기안문" 컨셉.
 *        문서번호·결재란(로드 시 볼펜 서명 애니메이션)·제목 서식·초안 타이핑 데모.
 *        텍스트는 DB(front_content) 우선, 없으면 GenieWork 기본값.
 */

import Button from '@/components/ui/Button'
import { FieldLabel } from '@/components/ui/Section'
import HeroDraftDemo from '@/components/sections/HeroDraftDemo'

export interface HeroContent {
  badge?: string | null
  headline1?: string | null
  headline2?: string | null
  subtext?: string | null
  cta1_text?: string | null
  cta1_href?: string | null
  cta2_text?: string | null
  cta2_href?: string | null
}

interface Props {
  content?: HeroContent
}

const defaults: Required<HeroContent> = {
  badge: '공무원·공공기관 실무자를 위한 업무 자동화',
  headline1: '보고서, 이제',
  headline2: '저절로 써집니다',
  subtext:
    '계획서·보고서·공문 초안 작성과 자료 검색까지 — 반복되는 문서 업무를 AI로 줄이는 설치형 프로그램, 지니워크(GenieWork)입니다.',
  cta1_text: '제품 둘러보기',
  cta1_href: '#product',
  cta2_text: '무료 계정 만들기',
  cta2_href: '/auth/register',
}

/** 결재란 서명 스트로크 — 셀마다 다른 볼펜 낙서 경로 */
const SIGN_PATHS = [
  'M6 26 C 12 8, 18 8, 22 20 C 25 28, 30 26, 33 14 C 35 8, 40 10, 46 24',
  'M8 24 C 16 6, 22 30, 28 16 C 32 8, 34 24, 40 18 C 43 15, 45 17, 46 20',
  'M7 20 C 13 10, 17 26, 23 22 C 30 17, 27 8, 34 10 C 42 13, 38 28, 46 22',
]
const SIGN_ROLES = ['담당', '검토', '승인']

export default function HeroSection({ content }: Props) {
  const c: Required<HeroContent> = {
    ...defaults,
    ...Object.fromEntries(
      Object.entries(content ?? {}).filter(([, v]) => v != null && v !== '')
    ),
  }

  // 문서번호 — 시행일 기반 (force-dynamic 페이지라 요청 시점 날짜)
  const now = new Date()
  const yyyy = now.getFullYear()
  const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const docDate = `${yyyy}. ${now.getMonth() + 1}. ${now.getDate()}.`

  return (
    <section id="hero" className="border-b border-rule">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16 sm:pb-24 flex flex-col items-center text-center">

        {/* 문서 정보 + 결재란 — 중앙 배치 */}
        <div className="flex flex-col items-center gap-6 mb-12 sm:mb-14 animate-fade-up">
          <dl className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center gap-2">
              <dt className="font-sans font-bold tracking-[0.2em] text-ink">문서번호</dt>
              <dd className="font-mono text-[13px] text-ink-soft">코어젠트-{yyyy}-제{mmdd}호</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="font-sans font-bold tracking-[0.2em] text-ink">시행일자</dt>
              <dd className="font-mono text-[13px] text-ink-soft">{docDate}</dd>
            </div>
          </dl>

          {/* 결재란 — 로드 후 순서대로 서명됨 */}
          <div className="flex border-[1.5px] border-ink bg-paper-raised" aria-hidden="true">
            <div className="flex items-center border-r-[1.5px] border-ink bg-paper-shade px-1.5 py-2 font-sans text-[11px] font-bold [writing-mode:vertical-rl] tracking-[0.5em]">
              결재
            </div>
            {SIGN_ROLES.map((role, i) => (
              <div key={role} className={`flex w-16 flex-col ${i < 2 ? 'border-r border-ink' : ''}`}>
                <div className="border-b border-ink bg-paper-shade py-0.5 text-center font-sans text-[10px] tracking-[0.2em]">
                  {role}
                </div>
                <div className="flex h-11 items-center justify-center">
                  <svg viewBox="0 0 52 36" className="h-8 w-12 overflow-visible">
                    <path
                      d={SIGN_PATHS[i]}
                      fill="none" stroke="#1D3FB0" strokeWidth="2.4" strokeLinecap="round"
                      style={{
                        strokeDasharray: 160,
                        strokeDashoffset: 160,
                        animation: `draw-stroke 0.7s ease-out ${0.9 + i * 0.55}s forwards`,
                      }}
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 제목 서식 — 중앙 정렬 */}
        <div className="flex flex-col items-center animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <p className="mb-4 font-sans text-sm font-medium text-pen">{c.badge}</p>
          <FieldLabel>제목</FieldLabel>
          <h1 className="font-serif font-black text-4xl sm:text-6xl lg:text-7xl leading-[1.18] tracking-tight text-ink break-keep">
            {c.headline1}
            <br />
            <span className="underline decoration-pen/80 decoration-4 sm:decoration-[6px] underline-offset-8">
              {c.headline2}
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-ink-soft break-keep">
            {c.subtext}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-9 flex flex-col sm:flex-row justify-center gap-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <Button href={c.cta1_href ?? '#'} size="lg">{c.cta1_text}</Button>
          <Button href={c.cta2_href ?? '#'} variant="outline" size="lg">{c.cta2_text}</Button>
        </div>

        {/* 신뢰 요소 */}
        <div className="mt-8 flex flex-wrap justify-center gap-2.5 animate-fade-up" style={{ animationDelay: '0.28s' }}>
          {['개발자가 직접 제작', '라이선스 즉시 활성화', '간편한 요금제', '전담 고객 지원'].map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-2 rounded border border-rule bg-paper-shade px-3 py-1 font-sans text-xs text-ink-soft"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-pen shrink-0" />
              {item}
            </span>
          ))}
        </div>

        {/* 초안 자동 작성 데모 — 문서는 좌측 정렬 유지(가독성), 블록만 중앙 */}
        <div className="mt-14 w-full flex justify-center animate-fade-up" style={{ animationDelay: '0.36s' }}>
          <HeroDraftDemo />
        </div>
      </div>
    </section>
  )
}
