/**
 * @파일: lib/signup-tracking.ts
 * @설명: 소셜 가입 측정 전달값의 단일 출처 — 콜백(서버, 쿠키 심기)과 감지 부품
 *        (SignupTracker, 쿠키 읽기)이 이 상수·정규화를 공유한다(사본 금지).
 *        구조: 소셜 가입은 서버 콜백에서 끝나는데 측정은 브라우저(gtag)에서만 나가므로,
 *        콜백이 "신규 가입(운영 검증된 5분 창 판정)"일 때만 1회용 쿠키에 가입 방식
 *        이름 하나를 담아 넘기고, 브라우저 부품이 읽어 기존 sign_up 사건으로 1회
 *        전송한 뒤 즉시 지운다. ⚠️ 쿠키에 개인정보(이름·이메일·고유번호) 금지 —
 *        담기는 값은 방식 이름(kakao 등) 하나뿐이다.
 */

/** 1회용 쿠키 이름 — 값은 가입 방식 이름 하나(개인정보 없음) */
export const SIGNUP_METHOD_COOKIE = 'cz_signup_method'

/** 쿠키 수명(초) — 도착 페이지가 읽자마자 지우므로 짧게. 못 읽어도 이 시간 뒤 소멸 */
export const SIGNUP_METHOD_COOKIE_MAX_AGE = 60

/** 브라우저 1회 표식(localStorage 키) — 같은 브라우저에서 가입을 두 번 세지 않는 잠금 */
export const SIGNUP_TRACKED_KEY = 'cz_signup_tracked'

/** 표식 유효 시간 — 신규 판정 창(5분)을 덮는 10분만 잠근다. 영구로 잠그면 공용 PC에서
 *  다음 사람의 진짜 가입이 영영 안 세진다(검증 지적) — 10분 뒤엔 표식이 무효가 된다 */
export const SIGNUP_TRACKED_TTL_MS = 10 * 60 * 1000

/**
 * @함수명: isRecentlyTracked
 * @설명: 표식 값(기록 시각)이 아직 유효한지 판정합니다. 숫자가 아니거나 10분이 지났으면
 *        무효(false) — 다시 셀 수 있는 상태로 봅니다.
 * @매개변수: raw - localStorage에 저장된 표식 값
 * @반환값: 10분 안에 기록된 표식이면 true
 */
export function isRecentlyTracked(raw: string | null): boolean {
  if (!raw) return false
  const t = parseInt(raw, 10)
  return Number.isFinite(t) && Date.now() - t < SIGNUP_TRACKED_TTL_MS
}

/** 측정에 담을 수 있는 소셜 방식 4종 — 하나라도 빠지면 실패(지시) */
const KNOWN_SOCIAL_METHODS = ['kakao', 'github', 'google', 'naver'] as const

/**
 * @함수명: normalizeSignupMethod
 * @설명: 인증 도구가 주는 provider 값을 측정용 방식 이름으로 정규화합니다.
 *        네이버는 커스텀 공급자라 'custom:naver' 형태로 올 수 있어 접두사를 벗깁니다.
 *        이메일('email')은 가입 폼이 이미 세고 있으므로 여기서는 null(쿠키 안 심음 —
 *        이중 계수 방지). 목록 밖 값도 null(모르는 값을 수치에 섞지 않는다).
 * @매개변수: provider - user.app_metadata.provider 값
 * @반환값: 'kakao'|'github'|'google'|'naver' 또는 null(측정 대상 아님)
 */
export function normalizeSignupMethod(provider: unknown): string | null {
  if (typeof provider !== 'string') return null
  // trim을 먼저 — 앞뒤 공백이 있으면 custom: 접두 제거가 빗나간다(검증 지적)
  const p = provider.trim().toLowerCase().replace(/^custom:/, '')
  return (KNOWN_SOCIAL_METHODS as readonly string[]).includes(p) ? p : null
}
