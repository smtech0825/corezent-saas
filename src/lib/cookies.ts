/**
 * @파일: lib/cookies.ts
 * @설명: 클라이언트 사이드 쿠키 유틸리티
 *        - 쿠키 동의 상태 관리 (GDPR/CCPA)
 *        - UTM / Referral 파라미터 캡처 및 보관
 */

// ─── 쿠키 키 상수 ─────────────────────────────────────────────────────────────
export const CONSENT_COOKIE  = 'cookie_consent'  // 동의 상태 (1년)
export const UTM_COOKIE      = 'utm_data'         // UTM 파라미터 (30일)
export const RETURN_TO_COOKIE = 'return_to'       // 로그인 후 돌아갈 경로 (서버 전용)

export type ConsentLevel = 'all' | 'essential'

export interface UtmData {
  utm_source?:   string
  utm_medium?:   string
  utm_campaign?: string
  utm_content?:  string
  utm_term?:     string
  ref?:          string
  captured_at:   string
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

function rawSet(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function rawGet(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

// ─── 쿠키 동의 ───────────────────────────────────────────────────────────────

/**
 * @함수명: getConsent
 * @설명: 현재 쿠키 동의 상태를 반환합니다. 미설정 시 null.
 */
export function getConsent(): ConsentLevel | null {
  const v = rawGet(CONSENT_COOKIE)
  return v === 'all' || v === 'essential' ? v : null
}

/**
 * @함수명: setConsent
 * @설명: 쿠키 동의 상태를 저장하고, 변경 이벤트를 발생시킵니다.
 */
export function setConsent(level: ConsentLevel): void {
  rawSet(CONSENT_COOKIE, level, 365)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: level }))
  }
}

// ─── UTM / Referral 추적 ──────────────────────────────────────────────────────

/**
 * @함수명: getUtmData
 * @설명: 저장된 UTM 파라미터를 반환합니다.
 */
export function getUtmData(): UtmData | null {
  const raw = rawGet(UTM_COOKIE)
  if (!raw) return null
  try { return JSON.parse(raw) as UtmData } catch { return null }
}

/**
 * @함수명: captureUtmFromSearch
 * @설명: URL 쿼리스트링에서 UTM 파라미터를 추출해 쿠키에 저장합니다.
 *        이미 저장된 UTM이 있으면 덮어쓰지 않습니다 (첫 방문 출처 보존).
 */
export function captureUtmFromSearch(search: string): void {
  if (typeof document === 'undefined') return
  // 이미 저장된 UTM이 있으면 덮어쓰지 않음
  if (rawGet(UTM_COOKIE)) return

  const params = new URLSearchParams(search)
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'] as const
  const utm: Partial<UtmData> = {}
  let hasData = false

  for (const k of keys) {
    const v = params.get(k)
    if (v) { utm[k] = v; hasData = true }
  }

  if (hasData) {
    rawSet(UTM_COOKIE, JSON.stringify({ ...utm, captured_at: new Date().toISOString() }), 30)
  }
}
