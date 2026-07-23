/**
 * @파일: lib/onboarding.ts
 * @설명: 로그인 필수(보호) 영역 진입 시 전화번호 온보딩 게이트 공용 로직.
 *        provider(이메일·카카오·네이버) 무관하게 동작한다 — provider가 늘어나도
 *        게이트 로직은 변경되지 않는다(보편 해결). redirect() 호출은
 *        서버 컴포넌트/레이아웃이 반환값을 보고 직접 수행한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { pickMetadataPhone } from './phone'

/** 온보딩 전화번호 입력 페이지 경로 */
export const ONBOARDING_PHONE_PATH = '/onboarding/phone'

/**
 * @함수명: ensureOnboardedPhone
 * @설명: 보호영역 레이아웃이 이미 조회한 profiles.phone을 받아 전화번호를 확정한다.
 *        - 값이 있으면 그대로 반환.
 *        - 비어 있으면 인증 메타데이터(가입 시 입력 또는 소셜 provider 제공)의 phone을
 *          정규화해 profiles.phone에 1회 동기화하고 반환(자가 치유).
 *        - 메타데이터에도 없으면 null 반환 → 호출부가 온보딩 게이트로 리다이렉트.
 *        레이아웃의 기존 profiles 조회에 phone 컬럼만 얹어 호출하므로 추가 조회 왕복이 없다.
 * @매개변수:
 *   admin        - service_role Supabase 클라이언트(RLS 우회)
 *   userId       - 대상 사용자 ID
 *   existingPhone- 레이아웃이 이미 select한 profiles.phone(없으면 null)
 *   metadata     - user.user_metadata(전화 후보 탐색용)
 * @반환값: 정규화된 전화번호(01012345678) 또는 null(게이트 필요)
 */
export async function ensureOnboardedPhone(
  admin: SupabaseClient,
  userId: string,
  existingPhone: string | null | undefined,
  metadata: unknown,
): Promise<string | null> {
  const existing = (existingPhone ?? '').trim()
  if (existing) return existing

  // 메타데이터에서 전화번호를 찾아 1회 동기화 시도(가입 폼 입력·소셜 제공값)
  const fromMeta = pickMetadataPhone(metadata)
  if (fromMeta) {
    // 동기화 실패해도 아래에서 게이트로 폴백되므로 흐름은 안전
    const { error } = await admin
      .from('profiles')
      .update({ phone: fromMeta })
      .eq('id', userId)
    if (!error) return fromMeta
  }

  return null
}

/**
 * @함수명: buildPhoneGateRedirect
 * @설명: 온보딩 전화번호 게이트로 보낼 URL을 만든다. 저장 후 원래 가려던 경로로
 *        복귀하도록 redirect 쿼리를 붙인다(오픈 리다이렉트 방지: 내부 경로만 허용).
 * @매개변수: returnTo - 저장 후 복귀할 내부 경로(기본 /dashboard)
 * @반환값: 게이트 경로(+redirect 쿼리)
 */
export function buildPhoneGateRedirect(returnTo: string = '/dashboard'): string {
  const safe = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard'
  return `${ONBOARDING_PHONE_PATH}?redirect=${encodeURIComponent(safe)}`
}
