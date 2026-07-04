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
 * @설명: Lemon Squeezy 체크아웃 URL에 user_id·UTM·추천인(affiliate_ref)을 custom_data로 주입합니다.
 *        웹훅에서 주문을 올바른 사용자·마케팅 채널·추천인에 연결하기 위해 사용합니다.
 *        affiliate_ref는 서버에서 해석(httpOnly cz_ref·referred_by)된 값을 받아 주입 시점에 sanitize합니다.
 *        quantity(같은 상품 N개)는 LS 공식 `quantity` URL 파라미터로 전달 — 2 이상일 때만 부착.
 *        discountCode는 LS 공식 `checkout[discount_code]` 파라미터로 전달(체크아웃에 프리필,
 *        유효성 검증·금액 계산은 LS가 수행) — 값이 있을 때만 부착.
 *        청구지 국가는 `checkout[billing_address][country]=KR`로 기본 프리필(한국) — baseUrl에 국가가 없을 때만.
 *        로그인 사용자의 가입 이메일·이름은 `checkout[email]`·`checkout[name]`으로 기본 프리필 — 값이 있을 때만
 *        (비로그인·이름 미설정이면 해당 키 생략). searchParams가 값을 URL 인코딩하므로 한글 이름도 안전.
 * @매개변수: baseUrl - LS 체크아웃 URL, userId - Supabase 사용자 UUID, utm - UTM/추천인 데이터,
 *           quantity - 구매 수량(기본 1), discountCode - LS 할인코드(선택),
 *           prefill - 로그인 사용자 이메일·이름 프리필(선택; 값 없으면 키 생략)
 * @반환값: custom_data·프리필이 포함된 체크아웃 URL
 */
export function buildCheckoutUrl(
  baseUrl: string,
  userId?: string | null,
  utm?: {
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
    ref?: string
    affiliate_ref?: string
  } | null,
  quantity?: number,
  discountCode?: string,
  prefill?: { email?: string | null; name?: string | null } | null,
): string {
  if (!baseUrl || baseUrl === '#') return baseUrl || '#'
  try {
    // URLSearchParams는 [] → %5B%5D 로 인코딩해 LS가 인식 못함
    // 브래킷을 그대로 유지하기 위해 문자열 직접 조합
    const url = new URL(baseUrl)
    // 수량: 정수 2 이상일 때만 부착(1이면 기존 URL과 동일 — 회귀 없음)
    if (quantity && Number.isFinite(quantity)) {
      const q = Math.floor(quantity)
      if (q >= 2) url.searchParams.set('quantity', String(q))
    }
    // 할인코드: 영숫자·-·_만 허용해 sanitize, 빈 값이면 키 자체를 생략
    if (discountCode) {
      const code = discountCode.trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
      if (code) url.searchParams.set('checkout[discount_code]', code)
    }
    // 청구지 국가 기본값: 한국(KR). LS 호스티드 체크아웃은 checkout[billing_address][country]로 국가를
    // 프리필하며 ISO 3166-1 alpha-2 코드를 받는다(REST API의 checkout_data.billing_address.country와 동등).
    // 고객이 체크아웃에서 변경 가능한 "기본값"이며(잠금 아님), 가격·세금·할인 파라미터와 독립적이라 충돌하지 않는다.
    // baseUrl에 이미 국가가 지정돼 있으면 그 값을 우선(비파괴적 기본값).
    if (!url.searchParams.has('checkout[billing_address][country]')) {
      url.searchParams.set('checkout[billing_address][country]', 'KR')
    }
    // 로그인 사용자 프리필: LS 호스티드 체크아웃의 이메일·이름 필드 기본값(고객이 변경 가능, 잠금 아님).
    // searchParams.set이 값을 URL 인코딩하므로 한글 이름·이메일 특수문자도 안전(LS가 디코드).
    // 값이 없으면(비로그인·이름 미설정) 키 자체를 생략해 기존 동작(파라미터 없음)과 동일하게 둔다.
    if (prefill?.email) {
      const em = prefill.email.trim()
      if (em) url.searchParams.set('checkout[email]', em)
    }
    if (prefill?.name) {
      const nm = prefill.name.trim()
      if (nm) url.searchParams.set('checkout[name]', nm)
    }
    if (userId)              url.searchParams.set('checkout[custom][user_id]',     userId)
    if (utm?.utm_source)     url.searchParams.set('checkout[custom][utm_source]',   utm.utm_source)
    if (utm?.utm_medium)     url.searchParams.set('checkout[custom][utm_medium]',   utm.utm_medium)
    if (utm?.utm_campaign)   url.searchParams.set('checkout[custom][utm_campaign]', utm.utm_campaign)
    if (utm?.utm_content)    url.searchParams.set('checkout[custom][utm_content]',  utm.utm_content)
    if (utm?.utm_term)       url.searchParams.set('checkout[custom][utm_term]',     utm.utm_term)
    if (utm?.ref)            url.searchParams.set('checkout[custom][ref]',           utm.ref)
    // 추천인 코드: 주입 시점에 대문자 영숫자로 sanitize, 빈 값이면 키 자체를 생략
    if (utm?.affiliate_ref) {
      const affRef = utm.affiliate_ref.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32)
      if (affRef) url.searchParams.set('checkout[custom][affiliate_ref]', affRef)
    }
    return url.toString()
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

/**
 * @함수명: fetchLsLicenseKeys
 * @설명: LS API를 호출하여 주문에 연결된 라이선스 키 "전체 목록"을 가져옵니다.
 *        LS는 수량과 무관하게 주문당 1개 키만 발급하는 것이 기본이지만,
 *        복수 키가 존재하는 경우까지 모두 수거해 수량 N 발급에 활용합니다.
 * @매개변수: lsOrderId - Lemon Squeezy 주문 ID (숫자 문자열)
 * @반환값: 라이선스 키 배열 (미발견/에러 시 빈 배열)
 */
export async function fetchLsLicenseKeys(lsOrderId: string): Promise<string[]> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  if (!apiKey) {
    console.warn('[LS API] LEMONSQUEEZY_API_KEY 미설정 — 라이선스 키 조회 건너뜀')
    return []
  }

  try {
    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/license-keys?filter[order_id]=${lsOrderId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/vnd.api+json',
        },
      },
    )

    if (!res.ok) {
      console.error(`[LS API] 라이선스 키 조회 실패: ${res.status}`)
      return []
    }

    const json = await res.json()
    const keys = json.data as Array<{ attributes: { key: string } }> | undefined
    return (keys ?? []).map((k) => k.attributes?.key).filter((k): k is string => Boolean(k))
  } catch (err) {
    console.error('[LS API] 라이선스 키 조회 오류:', err)
    return []
  }
}

/**
 * @함수명: fetchLsLicenseKey
 * @설명: 주문에 연결된 첫 번째 라이선스 키를 가져옵니다 (단일 키 호환용).
 * @매개변수: lsOrderId - Lemon Squeezy 주문 ID (숫자 문자열)
 * @반환값: 라이선스 키 문자열 또는 null (미발견/에러 시)
 */
export async function fetchLsLicenseKey(lsOrderId: string): Promise<string | null> {
  const keys = await fetchLsLicenseKeys(lsOrderId)
  return keys[0] ?? null
}

/**
 * @함수명: createLsDiscount
 * @설명: Lemon Squeezy에 1회용 "고정 금액(cents)" 할인 코드를 생성합니다.
 *        스토어 크레딧을 체크아웃 할인으로 반영하기 위한 1순위 경로.
 *        실패하면 ok:false를 반환하여 호출측이 관리자 수동 발급으로 폴백하게 한다.
 * @매개변수: code - 할인 코드, name - 할인명, amountCents - 고정 할인액(정수 cents)
 * @반환값: { ok, code?, error? }
 */
export async function createLsDiscount(params: {
  code: string
  name: string
  amountCents: number
}): Promise<{ ok: boolean; code?: string; error?: string }> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  if (!apiKey || !storeId) {
    return { ok: false, error: 'LEMONSQUEEZY_API_KEY/STORE_ID 미설정' }
  }
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) {
    return { ok: false, error: '유효하지 않은 할인 금액' }
  }

  try {
    const res = await fetch('https://api.lemonsqueezy.com/v1/discounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'discounts',
          attributes: {
            name: params.name,
            code: params.code,
            amount: params.amountCents, // 정수 cents
            amount_type: 'fixed',
            is_limited_redemptions: true,
            max_redemptions: 1,
          },
          relationships: {
            store: { data: { type: 'stores', id: String(storeId) } },
          },
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `LS 할인 생성 실패: ${res.status} ${text.slice(0, 200)}` }
    }
    return { ok: true, code: params.code }
  } catch (err) {
    return { ok: false, error: `LS 할인 생성 오류: ${String(err)}` }
  }
}

// ─── Lemon Squeezy 웹훅 이벤트 타입 ──────────────────────────────────────────

export interface LSWebhookMeta {
  event_name: string
  // affiliate_ref: buildCheckoutUrl이 주입하는 추천인 코드. ref는 구버전 호환용.
  custom_data?: { user_id?: string; ref?: string; affiliate_ref?: string }
}

export interface LSOrderAttributes {
  identifier: string
  user_name: string
  user_email: string
  status: string      // 'paid' | 'pending' | 'refunded'
  total: number       // cents
  discount_total?: number  // cents — 할인코드 적용 시 할인된 금액 (total은 할인 후)
  currency: string
  first_order_item: {
    product_id: number
    variant_id: number
    product_name: string
    variant_name: string
    quantity?: number   // 구매 수량 (같은 상품 N개) — LS 주문 아이템 필드
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
  // 구독 수량(좌석) — LS 구독 아이템 필드. 수량 N 구독이면 N.
  first_subscription_item?: {
    quantity?: number
  } | null
}

export interface LSLicenseKeyAttributes {
  key: string
  key_short: string
  status: string
  disabled: boolean
  order_id: number
  order_item_id: number
  product_id: number
  store_id: number
  customer_id: number
  user_email: string
  user_name: string
  activation_limit: number | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

// subscription_payment_success 등에서 전달되는 구독 인보이스 객체.
// 금액은 모두 정수 cents. billing_reason으로 초기/갱신/변경을 구분.
export interface LSSubscriptionInvoiceAttributes {
  subscription_id: number
  billing_reason: string   // 'initial' | 'renewal' | 'updated'
  user_email?: string
  currency?: string
  subtotal?: number        // cents
  discount_total?: number  // cents
  tax?: number             // cents
  total: number            // cents (적립 기준 gross)
  status?: string
  created_at?: string
}

export interface LSWebhookPayload {
  meta: LSWebhookMeta
  data: {
    id: string
    type: string
    attributes:
      | LSOrderAttributes
      | LSSubscriptionAttributes
      | LSLicenseKeyAttributes
      | LSSubscriptionInvoiceAttributes
  }
}
