/**
 * @컴포넌트: TestimonialsSection
 * @설명: 고객 후기 섹션 — DB 데이터 우선, 없으면 기본값 사용
 */

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

const defaultTestimonials = [
  {
    id: 'default-1',
    quote:
      'GeniePost from CoreZent completely changed how I manage my blog. Setup took less than 10 minutes and my content has been on autopilot ever since. Brilliant product.',
    author_name: 'Sarah Chen',
    author_title: 'WordPress blogger & content creator',
    author_avatar: null,
    rating: 5,
    color: 'from-[#38BDF8] to-[#0ea5e9]',
  },
  {
    id: 'default-2',
    quote:
      'I love that the software is made by actual developers who care. The documentation is excellent, support is fast, and the product just works. No bloat, no nonsense.',
    author_name: 'Marcus Lee',
    author_title: 'Freelance Digital Marketer',
    author_avatar: null,
    rating: 5,
    color: 'from-[#818cf8] to-[#6c63ff]',
  },
  {
    id: 'default-3',
    quote:
      'Simple pricing, instant license delivery, and real support from the team that built it. CoreZent is exactly what software purchases should feel like.',
    author_name: 'Yuki Tanaka',
    author_title: 'Solopreneur & Indie Developer',
    author_avatar: null,
    rating: 5,
    color: 'from-[#34d399] to-[#10b981]',
  },
]

const avatarColors = [
  'from-[#38BDF8] to-[#0ea5e9]',
  'from-[#818cf8] to-[#6c63ff]',
  'from-[#34d399] to-[#10b981]',
  'from-[#f59e0b] to-[#d97706]',
  'from-[#f472b6] to-[#ec4899]',
]

export default function TestimonialsSection({ testimonials }: Props) {
  const items =
    testimonials && testimonials.length > 0
      ? testimonials.map((t, i) => ({ ...t, color: avatarColors[i % avatarColors.length] }))
      : defaultTestimonials

  return (
    <section id="testimonials" className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[#38BDF8] text-sm font-semibold tracking-widest uppercase mb-4">
            Testimonials
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Trusted by real users.
          </h2>
          <p className="text-[#94A3B8] text-lg">
            See what our customers are saying about CoreZent software.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((t) => {
            const initials = t.author_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()
            const stars = t.rating ?? 5

            return (
              <div
                key={t.id}
                className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-7 flex flex-col gap-6 hover:border-[#38BDF8]/20 transition-colors duration-300"
              >
                {/* Stars */}
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 fill-current ${i < stars ? 'text-amber-400' : 'text-[#1E293B]'}`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                <blockquote className="text-sm text-[#94A3B8] leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <div className="flex items-center gap-3">
                  {t.author_avatar ? (
                    <img
                      src={t.author_avatar}
                      alt={t.author_name}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-xs font-bold text-white shrink-0`}
                    >
                      {initials}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">{t.author_name}</p>
                    {t.author_title && (
                      <p className="text-xs text-[#475569]">{t.author_title}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
