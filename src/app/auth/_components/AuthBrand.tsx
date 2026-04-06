/**
 * @컴포넌트: AuthBrand
 * @설명: 로그인/회원가입 페이지 오른쪽 브랜드 영역
 *        lg 이상 화면에서만 표시, 로고 + 슬로건 + 배경 글로우
 */

export default function AuthBrand() {
  return (
    <div className="hidden lg:flex w-[480px] xl:w-[560px] flex-shrink-0 relative bg-[#111A2E] border-l border-[#1E293B] items-center justify-center overflow-hidden">
      {/* 배경 글로우 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(56,189,248,0.08), transparent)',
        }}
      />

      {/* 장식 원 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-[#38BDF8]/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full border border-[#38BDF8]/8" />

      {/* 브랜드 콘텐츠 */}
      <div className="relative z-10 text-center px-12">
        {/* 로고 */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="w-12 h-12 rounded-xl bg-[#38BDF8] flex items-center justify-center text-[#0B1120] text-2xl font-black">
            C
          </span>
          <span className="text-3xl font-bold text-white tracking-tight">CoreZent</span>
        </div>

        {/* 슬로건 */}
        <h2 className="text-2xl font-bold text-white leading-snug mb-4">
          Your software,<br />
          <span className="text-[#38BDF8]">subscribed.</span>
        </h2>
        <p className="text-[#94A3B8] text-sm leading-relaxed max-w-xs mx-auto">
          One account for all CoreZent tools.<br />
          Manage licenses, subscriptions, and more.
        </p>

        {/* 특징 3가지 */}
        <div className="mt-10 flex flex-col gap-3 text-left">
          {[
            { icon: '⚡', text: 'Instant license activation' },
            { icon: '🔒', text: 'Secure serial key management' },
            { icon: '📦', text: 'All your software in one place' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-[#94A3B8]">
              <span className="text-base">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
