/**
 * @파일: lib/lemonsqueezy.ts
 * @설명: Lemon Squeezy 웹훅 서명 검증 및 체크아웃 URL 빌더
 */

import crypto from 'crypto'

/**
 * @함수명: verifyLSWebhook
 * @설명: Lemon Squeezy 웹훅 요청의 HMAC-SHA256 서명을 검증합니다.
 * @매개변수: rawBody - 원시 요청 본문, signature - X-Signature 헤더값
 * @반환값: 서명이 유효하면 true
 */
export function verifyLSWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[LS Webhook] LEMONSQUEEZY_WEBHOOK_SECRET 환경변수가 설정되지 않았습니다.')
    return false
  }
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(rawBody)
  const computed = hmac.digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

/**
 * @함수명: buildCheckoutUrl
 * @설명: Lemon Squeezy 체크아웃 URL에 사용자 ID를 custom_data로 주입합니다.
 *        웹훅에서 주문을 올바른 사용자에게 연결하기 위해 사용합니다.
 * @매개변수: baseUrl - LS 체크아웃 URL, userId - Supabase 사용자 UUID
 * @반환값: user_id가 포함된 체크아웃 URL
 */
export function buildCheckoutUrl(baseUrl: string, userId?: string | null): string {
  if (!baseUrl || baseUrl === '#') return baseUrl || '#'
  try {
    // URLSearchParams는 [] → %5B%5D 로 인코딩해 LS가 인식 못함
    // 브래킷을 그대로 유지하기 위해 문자열 직접 조합
    const params: string[] = []
    if (userId) params.push(`checkout[custom][user_id]=${encodeURIComponent(userId)}`)
    // 결제 완료 후 대시보드 라이선스 페이지로 리다이렉트
    params.push(`checkout[redirect_url]=${encodeURIComponent('https://www.corezent.com/dashboard/licenses')}`)
    const separator = baseUrl.includes('?') ? '&' : '?'
    return baseUrl + separator + params.join('&')
  } catch {
    return baseUrl
  }
}

/**
 * @함수명: generateSerialKey
 * @설명: XXXX-XXXX-XXXX-XXXX 형식의 고유 시리얼 키를 생성합니다.
 *        혼동되기 쉬운 문자(0, O, 1, I, L)를 제외합니다.
 * @반환값: 생성된 시리얼 키 문자열
 */
export function generateSerialKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${segment()}-${segment()}-${segment()}-${segment()}`
}

// ─── Lemon Squeezy 웹훅 이벤트 타입 ──────────────────────────────────────────

export interface LSWebhookMeta {
  event_name: string
  custom_data?: { user_id?: string }
}

export interface LSOrderAttributes {
  identifier: string
  user_name: string
  user_email: string
  status: string      // 'paid' | 'pending' | 'refunded'
  total: number       // cents
  currency: string
  first_order_item: {
    product_id: number
    variant_id: number
    product_name: string
    variant_name: string
  }
}

export interface LSSubscriptionAttributes {
  order_id: number
  user_name: string
  user_email: string
  status: string      // 'active' | 'paused' | 'cancelled' | 'expired' | 'past_due'
  product_id: number
  variant_id: number
  renews_at: string | null
  ends_at: string | null
  cancelled: boolean
  pause: null | { mode: string }
  urls: {
    customer_portal: string
    update_payment_method: string
  }
  billing_anchor: number
}

export interface LSWebhookPayload {
  meta: LSWebhookMeta
  data: {
    id: string
    type: string
    attributes: LSOrderAttributes | LSSubscriptionAttributes
  }
}
