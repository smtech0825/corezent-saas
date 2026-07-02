/**
 * @컴포넌트: TestimonialsSection
 * @설명: 도입 후기 (페이퍼 테마) — 공문 인용/의견란 스타일 카드.
 *        DB(front_interviews) 데이터 우선. 후기가 하나도 없으면 섹션 숨김
 *        (가짜 후기 노출 방지 — 실사용 후기가 쌓이면 자동 표시).
 */

import Section, { SectionHeader } from '@/components/ui/Section'

export interface DbTestimonial {
  id: string
  quote: string
  author_name: string
  author_title: string | null
  author_avatar: string | null
  rating: number | null
}

interface Props {
  testimonials?: DbTestimonial[]
}

/** 이름 기반 라이트 파스텔 아바타 배경 */
const AVATAR_BG = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
]

export default function TestimonialsSection({ testimonials }: Props) {
  // 실제 후기가 없으면 렌더링하지 않음 (가짜 후기 배제)
  if (!testimonials || testimonials.length === 0) return null

  return (
    <Section id="testimonials" width="wide">
      <SectionHeader label="도입 후기" title="현장의 이야기" align="center" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {testimonials.map((t, i) => {
          const initials = t.author_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
          const stars = t.rating ?? 5
          const avatarCls = AVATAR_BG[i % AVATAR_BG.length]

          return (
            <div
              key={t.id}
              className="rounded-lg border border-rule bg-paper-raised p-6 flex flex-col gap-5 shadow-[0_1px_2px_rgba(35,39,46,0.05)]"
            >
              <div className="flex gap-1">
                {[...Array(5)].map((_, s) => (
                  <svg
                    key={s}
                    className={`w-4 h-4 fill-current ${s < stars ? 'text-amber-500' : 'text-rule'}`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <blockquote className="text-sm text-ink leading-relaxed flex-1 break-keep">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3 pt-1 border-t border-rule">
                {t.author_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.author_avatar} alt={t.author_name} className="w-9 h-9 rounded-full object-cover shrink-0 mt-3" />
                ) : (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-3 ${avatarCls}`}>
                    {initials}
                  </div>
                )}
                <div className="mt-3">
                  <p className="text-sm font-semibold text-ink">{t.author_name}</p>
                  {t.author_title && <p className="text-xs text-ink-faint">{t.author_title}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
