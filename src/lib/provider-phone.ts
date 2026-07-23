/**
 * @파일: lib/provider-phone.ts
 * @설명: 소셜 로그인(OAuth) provider가 제공하는 휴대전화번호를 추출·동기화하는 공용 모듈.
 *        provider별 분기는 REMOTE_FETCHERS 맵 한 곳에만 존재한다 — provider가 늘어나도
 *        콜백/게이트 로직은 변경되지 않는다(보편 해결). Wave 4(네이버)는 이 맵에
 *        매퍼 한 줄만 추가한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeKoreanPhone, pickMetadataPhone } from './phone'

/** provider access token(provider_token)으로 원격 사용자정보 API에서 전화번호를 조회하는 함수 시그니처 */
type RemoteFetcher = (providerToken: string) => Promise<string | null>

/**
 * @함수명: fetchKakaoPhone
 * @설명: 카카오 사용자정보 API(/v2/user/me)에서 kakao_account.phone_number를 조회한다.
 *        전화번호는 비즈앱 전환 + 검수 통과 시에만 내려온다(형식 예: "+82 10-1234-5678").
 * @매개변수: providerToken - 카카오 OAuth access token(Supabase 세션의 provider_token)
 * @반환값: 정규화된 번호(01012345678) 또는 조회 실패·미제공 시 null
 */
async function fetchKakaoPhone(providerToken: string): Promise<string | null> {
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${providerToken}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { kakao_account?: { phone_number?: string | null } }
  return normalizeKoreanPhone(data?.kakao_account?.phone_number ?? null)
}

/**
 * provider별 원격 전화번호 조회 매퍼.
 * key = user.app_metadata.provider 값. provider 추가 시 이 맵에만 한 줄 추가.
 */
const REMOTE_FETCHERS: Record<string, RemoteFetcher> = {
  kakao: fetchKakaoPhone,
  // naver: fetchNaverPhone,  // Wave 4에서 추가
}

/** syncProviderPhoneIfMissing가 필요로 하는 최소 사용자/세션 형태 */
interface MinimalUser {
  id: string
  app_metadata?: { provider?: string } | null
  user_metadata?: unknown
}
interface MinimalSession {
  provider_token?: string | null
}

/**
 * @함수명: syncProviderPhoneIfMissing
 * @설명: OAuth 콜백에서 profiles.phone이 비어 있을 때에 한해 provider가 제공하는
 *        전화번호를 정규화해 1회 저장한다. 이미 값이 있으면 덮어쓰지 않는다.
 *          1) 세션 user_metadata에 phone이 있으면 그대로 사용
 *          2) 없으면 provider별 원격 API(provider_token)로 조회
 *        전화번호가 없거나 조회에 실패해도 예외를 던지지 않는다 — 가입은 그대로 진행되고
 *        Wave 1 온보딩 게이트가 소급 수집한다(검수 전에도 배포 가능한 구조).
 *        전화 제공 가능성이 없는 provider(google/github 등)는 추가 조회 없이 즉시 종료해
 *        기존 소셜 로그인 성능에 영향을 주지 않는다.
 * @매개변수: admin - service_role 클라이언트, user - 세션 사용자, session - 세션(provider_token)
 * @반환값: 없음(부수효과: profiles.phone 갱신 가능)
 */
export async function syncProviderPhoneIfMissing(
  admin: SupabaseClient,
  user: MinimalUser,
  session: MinimalSession | null,
): Promise<void> {
  const provider = user.app_metadata?.provider
  const metaPhone = pickMetadataPhone(user.user_metadata)
  const hasRemote = !!(provider && provider in REMOTE_FETCHERS)

  // 전화 제공 경로가 전혀 없는 provider는 조회 없이 종료(google/github 등)
  if (!metaPhone && !hasRemote) return

  const { data: prof } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .single()
  if ((prof as { phone?: string | null } | null)?.phone) return // 이미 있으면 덮어쓰기 금지

  let phone = metaPhone
  if (!phone && hasRemote && session?.provider_token) {
    try {
      phone = await REMOTE_FETCHERS[provider!](session.provider_token)
    } catch {
      phone = null // 실패해도 가입 흐름 유지(게이트가 수집)
    }
  }

  if (phone) {
    await admin.from('profiles').update({ phone }).eq('id', user.id)
  }
}
