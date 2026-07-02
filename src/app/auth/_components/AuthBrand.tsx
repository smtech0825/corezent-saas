/**
 * @컴포넌트: AuthBrand
 * @설명: 로그인/회원가입 페이지 오른쪽 브랜드 영역
 *        lg 이상 화면에서만 표시, 로고 + 슬로건 + 배경 글로우
 */

export default function AuthBrand() {
  return (
    <div className="theme-paper hidden lg:flex w-[480px] xl:w-[560px] flex-shrink-0 relative bg-gradient-to-br from-paper-shade to-paper border-l border-rule items-center justify-center overflow-hidden">
      {/* 배경 글로우 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(29,63,176,0.06), transparent)',
        }}
      />

      {/* 장식 원 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-rule" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full border border-pen/15" />

      {/* 브랜드 콘텐츠 */}
      <div className="relative z-10 text-center px-12">
        {/* 로고 */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="w-12 h-12 rounded border-2 border-seal flex items-center justify-center text-seal text-2xl font-black -rotate-3">
            C
          </span>
          <span className="text-3xl font-bold text-ink tracking-tight">CoreZent</span>
        </div>

        {/* 슬로건 */}
        <h2 className="text-2xl font-serif font-black text-ink leading-snug mb-4">
          모든 소프트웨어를<br />
          <span className="text-pen">하나의 계정으로</span>
        </h2>
        <p className="text-ink-soft text-sm leading-relaxed max-w-xs mx-auto">
          모든 CoreZent 도구를 하나의 계정으로.<br />
          라이선스와 구독을 한곳에서 관리하세요.
        </p>

        {/* 특징 3가지 */}
        <div className="mt-10 flex flex-col gap-3 text-left">
          {[
            { icon: '⚡', text: '라이선스 즉시 활성화' },
            { icon: '🔒', text: '안전한 시리얼 키 관리' },
            { icon: '📦', text: '모든 소프트웨어를 한곳에' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-ink-soft">
              <span className="text-base">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
