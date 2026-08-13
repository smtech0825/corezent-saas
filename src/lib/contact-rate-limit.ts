/**
 * @파일: lib/contact-rate-limit.ts
 * @설명: 공개 폼(문의·기관 견적 요청)의 IP 기반 분당 횟수 제한 — 단일 출처.
 *        api/contact/route.ts에 있던 isRateLimited를 "이동만" 한 것(로직 변화 0).
 *        Supabase 테이블(contact_rate_limit) + 원자적 RPC(check_contact_rate_limit)를 쓰므로
 *        Vercel 서버리스 인스턴스가 여러 개 떠도 카운터가 공유되고 동시 요청 경합에도 안전하다.
 *        RPC 자체가 실패하면(마이그레이션 미적용 등) 정상 사용자를 막지 않도록 통과시킨다(fail-open).
 *        ⚠️ 문의와 견적이 같은 카운터를 공유한다(같은 IP 합산 분당 3회) — 봇 방어 목적상 의도된 동작.
 */

import type { createAdminClient } from './supabase/admin'

const RATE_LIMIT_WINDOW_MS = 60_000 // 1분 고정 윈도우
const RATE_LIMIT_MAX = 3            // 1분에 최대 3회

/**
 * @함수명: isRateLimited
 * @설명: 이번 요청이 분당 한도를 초과했는지 확인하고 카운터를 1 올립니다(원자적).
 * @매개변수: admin - service role Supabase 클라이언트 / ip - 요청자 IP
 * @반환값: 한도 초과면 true
 */
export async function isRateLimited(
  admin: ReturnType<typeof createAdminClient>,
  ip: string,
): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS).toISOString()

  const { data, error } = await admin.rpc('check_contact_rate_limit', {
    p_ip: ip,
    p_window_start: windowStart,
    p_max: RATE_LIMIT_MAX,
  })

  if (error) {
    console.error('[rate-limit] RPC error:', error)
    return false // fail-open — 체크 자체가 깨져도 정상 사용자는 막지 않음
  }

  return Boolean((data as { limited?: boolean } | null)?.limited)
}
