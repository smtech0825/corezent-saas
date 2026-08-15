/**
 * @파일: lib/analytics-events.ts
 * @설명: 방문→구매 흐름 측정 사건의 단일 출처 — 사건 이름은 반드시 여기서만 정한다
 *        (화면마다 흩지 말 것). 이미 연결된 구글 애널리틱스(gtag)로만 보낸다.
 *        ⚠️ 개인정보 금지 — 이름·이메일·전화번호를 사건 값에 절대 담지 않는다.
 *        ⚠️ 측정 실패가 본 동작(클릭·가입·결제)을 막으면 안 된다 — gtag가 없거나
 *        (쿠키 미동의·차단기) 실패해도 조용히 넘어간다.
 */

/** 사건 이름 — 기존 2종(pricing_toggle·view_product)은 이름 유지(수치 연속성) */
export const EVENT = {
  /** 요금 페이지 월간/연간 토글 (기존) */
  PRICING_TOGGLE: 'pricing_toggle',
  /** 요금 카드 → 제품 상세 보기 (기존) */
  VIEW_PRODUCT: 'view_product',
  /** 무료 체험 신청 버튼 클릭 — 값: placement(nav·nav-mobile·pricing) */
  TRIAL_APPLY_CLICK: 'trial_apply_click',
  /** 회원가입 요청 성공(이메일 가입) — 값: method */
  SIGN_UP: 'sign_up',
  /** 결제 시작(카드 체크아웃 이동·계좌이체 안내 열기) — 값: product(상품 slug)·method·placement */
  BEGIN_CHECKOUT: 'begin_checkout',
} as const

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * @함수명: trackEvent
 * @설명: 측정 사건 한 건을 보냅니다. gtag가 없으면(쿠키 미동의 등) 조용히 무시합니다.
 * @매개변수: name - EVENT의 사건 이름 / props - 부가 값(개인정보 금지)
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  try {
    window.gtag?.('event', name, props)
  } catch { /* 측정 실패는 본 동작을 막지 않는다 */ }
}
