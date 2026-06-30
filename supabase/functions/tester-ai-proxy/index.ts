/**
 * Supabase Edge Function: tester-ai-proxy
 * ──────────────────────────────────────────────────────────────────────────
 * 배포 대상 : ★ GenieWork 전용 Supabase 프로젝트 (license_keys 가 있는 GW_SUPABASE)
 * 역할      : 테스터 라이선스(키가 'test'로 시작)의 AI 호출을 서버에서 대리(proxy).
 *             진짜 AI 제공사 키는 이 함수의 env(Supabase secret)에만 존재 → 절대 클라 노출 X.
 *             라이선스별 USD 한도를 DB(tester_*)로 게이트하고, 성공분만 원자적으로 회계.
 *
 * 동시성    : Wave 3 — "호출당 최대비용 사전예약(reserve)→정산(settle)" 으로 오버슈트 차단.
 *   1) gate         : 값싼 사전 거름(미등록·비테스터·비활성·예산소진) — 불필요한 provider 콜 방지
 *   2) count_tokens : 입력 토큰 정확 측정(실패 시 보수적 추정) → worst-case 비용 산정
 *   3) reserve      : worst-case(=입력×단가 + max_tokens×단가)를 usd_spent에 hold(원자적)
 *   4) generate     : 서버 시크릿 키로 AI 호출
 *   5) settle/release : 성공→실제 토큰으로 정산(차액 환원) / 실패→hold 전액 환원
 *
 * env(Supabase secret) :
 *   SUPABASE_URL              (자동 주입)
 *   SUPABASE_SERVICE_ROLE_KEY (자동 주입 — RLS 우회, RPC 호출용)
 *   ANTHROPIC_API_KEY         (운영자가 `supabase secrets set` 으로 설정 — 서버 전용)
 *   ANTHROPIC_BASE_URL        (선택, 기본 https://api.anthropic.com)
 *   ANTHROPIC_VERSION         (선택, 기본 2023-06-01)
 *   TESTER_MAX_TOKENS         (선택, 기본 2048 — max_tokens 미지정 시 기본)
 *   TESTER_MAX_TOKENS_CAP     (선택, 기본 4096 — 콜당 출력 토큰 상한, 과지출 방지)
 *   TESTER_USE_COUNT_TOKENS   (선택, 기본 true — false면 추정만 사용)
 *   TESTER_CHARS_PER_TOKEN    (선택, 기본 3.5 — count_tokens 폴백 추정 계수)
 *
 * 배포      : supabase functions deploy tester-ai-proxy --project-ref <GW_PROJECT_REF>
 *           : supabase secrets set ANTHROPIC_API_KEY=... --project-ref <GW_PROJECT_REF>
 */

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── env ───────────────────────────────────────────────────────────────────
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY  = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const ANTHROPIC_BASE_URL = Deno.env.get('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com'
const ANTHROPIC_VERSION  = Deno.env.get('ANTHROPIC_VERSION') ?? '2023-06-01'
const DEFAULT_MAX_TOKENS = Number(Deno.env.get('TESTER_MAX_TOKENS') ?? '2048')
const MAX_TOKENS_CAP     = Number(Deno.env.get('TESTER_MAX_TOKENS_CAP') ?? '4096')
const USE_COUNT_TOKENS   = (Deno.env.get('TESTER_USE_COUNT_TOKENS') ?? 'true') !== 'false'
const CHARS_PER_TOKEN    = Number(Deno.env.get('TESTER_CHARS_PER_TOKEN') ?? '3.5')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 에러코드 → HTTP 상태 (앱이 코드로 분기)
const STATUS: Record<string, number> = {
  MALFORMED_REQUEST:          400,
  NOT_FOUND:                  404,
  NOT_TESTER:                 403,
  INACTIVE:                   403,
  TESTER_BUDGET_EXCEEDED:     402, // 한도 소진 — "본인 키를 넣으세요"
  TESTER_BUDGET_INSUFFICIENT: 402, // 잔여는 있으나 이번 콜 worst-case가 한도 초과
  PRICE_NOT_CONFIGURED:       503,
  NO_CONFIG:                  503,
  PROVIDER_ERROR:             502,
  SERVER_ERROR:               500,
}

/**
 * @함수명: errResponse
 * @설명: 표준 에러 응답(JSON) 생성. errorCode로 앱이 분기.
 */
function errResponse(code: string, message: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ ok: false, errorCode: code, error: message, ...extra }),
    { status: STATUS[code] ?? 500, headers: { ...CORS, 'content-type': 'application/json' } },
  )
}

/** AI 제공사 공통 헤더(키는 서버 전용 — 응답/로그 어디에도 미포함) */
function anthropicHeaders(): HeadersInit {
  return {
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
  }
}

/**
 * @함수명: estimateInputTokens
 * @설명: 예약용 입력 토큰 수 산정. count_tokens(정확) 우선, 실패 시 보수적 추정(상한).
 *        출력은 max_tokens로 이미 상한이 잡히므로, 입력만 정확하면 예약이 실제비용의 상한이 됨.
 * @반환값: 입력 토큰 수(정수)
 */
async function estimateInputTokens(
  model: string,
  messages: unknown,
  system: unknown,
): Promise<number> {
  if (USE_COUNT_TOKENS) {
    try {
      const reqBody: Record<string, unknown> = { model, messages }
      if (typeof system === 'string') reqBody.system = system
      const r = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages/count_tokens`, {
        method: 'POST',
        headers: anthropicHeaders(),
        body: JSON.stringify(reqBody),
      })
      if (r.ok) {
        const j = await r.json().catch(() => null)
        const n = Number((j as { input_tokens?: number } | null)?.input_tokens)
        if (Number.isFinite(n) && n >= 0) return Math.ceil(n)
      } else {
        console.error('[tester-ai-proxy] count_tokens status=', r.status)
      }
    } catch (e) {
      console.error('[tester-ai-proxy] count_tokens 실패(추정 폴백):', e)
    }
  }
  // 폴백: 문자 길이 기반 보수적 추정(상한 지향)
  const chars =
    JSON.stringify(messages ?? '').length + (typeof system === 'string' ? system.length : 0)
  return Math.ceil(chars / (CHARS_PER_TOKEN > 0 ? CHARS_PER_TOKEN : 3.5))
}

/** 예약 해제(AI 실패 시) — 실패해도 sweeper가 후속 회수하므로 throw 안 함 */
async function releaseReservation(admin: SupabaseClient, reservationId: string): Promise<void> {
  try {
    await admin.rpc('tester_ai_release', { p_reservation_id: reservationId })
  } catch (e) {
    console.error('[tester-ai-proxy] release 실패(sweeper가 회수 예정):', e, { reservationId })
  }
}

/**
 * @함수명: serve(handler)
 * @설명: 테스터 AI 프록시 엔트리. POST { key, model, messages, ... } 처리.
 */
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return errResponse('MALFORMED_REQUEST', 'POST 요청만 허용돼요.')

  // ── 1) 입력 파싱·검증 ──────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return errResponse('MALFORMED_REQUEST', '요청 본문이 올바른 JSON이 아니에요.')
  }

  const key      = typeof body?.key === 'string' ? body.key.trim() : ''
  const model    = typeof body?.model === 'string' ? body.model.trim() : ''
  const messages = body?.messages
  const system   = body?.system
  if (!key || !model || !Array.isArray(messages) || messages.length === 0) {
    return errResponse('MALFORMED_REQUEST', 'key·model·messages가 필요해요.')
  }

  if (!ANTHROPIC_API_KEY) {
    console.error('[tester-ai-proxy] ANTHROPIC_API_KEY 미설정 — secret 확인 필요')
    return errResponse('SERVER_ERROR', '서버 설정 오류예요. 운영자에게 문의해주세요.')
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 2) 값싼 사전 게이트 (provider 콜 전 거름) ────────────────────────────
  let gate: { ok?: boolean; reason?: string; spent?: number; cap?: number }
  try {
    const { data, error } = await admin.rpc('tester_ai_gate', { p_license_key: key, p_model: model })
    if (error) throw error
    gate = (data ?? {}) as typeof gate
  } catch (e) {
    console.error('[tester-ai-proxy] tester_ai_gate RPC 실패:', e)
    return errResponse('SERVER_ERROR', '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.')
  }
  if (!gate.ok) {
    return mapBudgetReason(gate.reason, gate.spent, gate.cap)
  }

  // ── 3) 입력 토큰 측정 + 출력 상한 → 사전예약(hold) ───────────────────────
  const reqMax = Number((body as { max_tokens?: unknown }).max_tokens)
  const maxOut = Math.min(Number.isFinite(reqMax) && reqMax > 0 ? reqMax : DEFAULT_MAX_TOKENS, MAX_TOKENS_CAP)
  const estIn  = await estimateInputTokens(model, messages, system)

  let reserve: { ok?: boolean; reason?: string; reservation_id?: string; reserved?: number; spent?: number; cap?: number; remaining?: number }
  try {
    const { data, error } = await admin.rpc('tester_ai_reserve', {
      p_license_key:       key,
      p_model:             model,
      p_est_input_tokens:  estIn,
      p_max_output_tokens: maxOut,
    })
    if (error) throw error
    reserve = (data ?? {}) as typeof reserve
  } catch (e) {
    console.error('[tester-ai-proxy] tester_ai_reserve RPC 실패:', e)
    return errResponse('SERVER_ERROR', '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.')
  }
  if (!reserve.ok || !reserve.reservation_id) {
    return mapBudgetReason(reserve.reason, reserve.spent, reserve.cap, reserve.remaining)
  }
  const reservationId = reserve.reservation_id

  // ── 4) AI 제공사 호출 (서버 시크릿 키 — 절대 클라이언트로 안 나감) ───────
  const payload: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxOut,
    stream: false, // usage 집계를 위해 비스트리밍 고정
  }
  if (typeof system === 'string') payload.system = system
  if (typeof body?.temperature === 'number') payload.temperature = body.temperature
  if (typeof body?.top_p === 'number') payload.top_p = body.top_p
  if (Array.isArray(body?.stop_sequences)) payload.stop_sequences = body.stop_sequences

  let providerJson: Record<string, unknown> | null
  try {
    const resp = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: anthropicHeaders(),
      body: JSON.stringify(payload),
    })
    providerJson = await resp.json().catch(() => null)
    if (!resp.ok) {
      const ptype = (providerJson as { error?: { type?: string } } | null)?.error?.type
      console.error('[tester-ai-proxy] provider 오류 status=', resp.status, 'type=', ptype)
      await releaseReservation(admin, reservationId) // 실패 → hold 환원
      return errResponse('PROVIDER_ERROR', 'AI 제공사 호출에 실패했어요.', { providerStatus: resp.status })
    }
  } catch (e) {
    console.error('[tester-ai-proxy] provider fetch 실패:', e)
    await releaseReservation(admin, reservationId) // 실패 → hold 환원
    return errResponse('PROVIDER_ERROR', 'AI 제공사 연결에 실패했어요.')
  }

  // ── 5) 정산 (실제 토큰 → hold 해제+실제비용 반영, 원자적) ─────────────────
  const usage = (providerJson as { usage?: { input_tokens?: number; output_tokens?: number } } | null)?.usage
  const inTok  = Number(usage?.input_tokens  ?? 0)
  const outTok = Number(usage?.output_tokens ?? 0)

  let settle: { ok?: boolean; cost?: number; spent?: number } | null = null
  try {
    const { data, error } = await admin.rpc('tester_ai_settle', {
      p_reservation_id:       reservationId,
      p_actual_input_tokens:  inTok,
      p_actual_output_tokens: outTok,
    })
    if (error) throw error
    settle = (data ?? null) as typeof settle
  } catch (e) {
    // AI는 이미 응답함 → 결과는 돌려주되 정산 실패를 큰 소리로 기록.
    // hold는 그대로 남아 cap을 보수적으로 보호하고, sweeper가 후속 환원(과소청구 위험 로그).
    console.error('[tester-ai-proxy] settle 실패(hold 잔존 — sweeper 회수 대기):', e, { reservationId, inTok, outTok })
  }

  // ── 6) AI 결과만 반환 (키·provider 인증 절대 미포함) ─────────────────────
  return new Response(
    JSON.stringify({
      ok: true,
      result: providerJson,
      budget: {
        cost:     settle?.cost,
        spent:    settle?.spent,
        reserved: reserve.reserved,
        cap:      reserve.cap,
      },
    }),
    { headers: { ...CORS, 'content-type': 'application/json' } },
  )
})

/**
 * @함수명: mapBudgetReason
 * @설명: gate/reserve 거부 reason → 사용자 메시지·HTTP 상태로 매핑.
 */
function mapBudgetReason(
  reason: string | undefined,
  spent?: number,
  cap?: number,
  remaining?: number,
): Response {
  const code = reason ?? 'SERVER_ERROR'
  const messageByReason: Record<string, string> = {
    NOT_FOUND:                  '등록되지 않은 라이선스 키예요.',
    NOT_TESTER:                 '테스터 전용 키가 아니에요.',
    INACTIVE:                   '비활성화된 라이선스예요. 고객센터에 문의해주세요.',
    PRICE_NOT_CONFIGURED:       '해당 모델의 단가가 설정되지 않았어요. 운영자에게 문의해주세요.',
    NO_CONFIG:                  '서버 설정이 누락됐어요. 운영자에게 문의해주세요.',
    TESTER_BUDGET_EXCEEDED:     '테스터 무료 한도를 모두 사용했어요. 본인 AI 키를 넣어주세요.',
    TESTER_BUDGET_INSUFFICIENT: '남은 한도가 이번 요청에 부족해요. 길이를 줄이거나 본인 AI 키를 넣어주세요.',
    INVALID_INPUT:              '입력값이 올바르지 않아요.',
  }
  return errResponse(code, messageByReason[code] ?? '요청을 처리할 수 없어요.', { spent, cap, remaining })
}
