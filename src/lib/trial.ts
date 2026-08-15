import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * @파일: lib/trial.ts
 * @설명: 무료 체험 신청 주소 공용 헬퍼 — 관리자 설정(front_settings)에서 읽는다.
 *        상수(키·기본 주소)는 클라이언트(설정 화면 placeholder)에서도 쓰지만,
 *        fetchTrialApplyUrl은 서버 전용(admin 클라이언트를 받는 쪽에서만) 호출한다.
 *        ⚠️ 체험 기간·횟수·제한은 정해진 것이 없다 — 어떤 화면에도 조건 문구를 적지 말 것.
 *        폴백 규칙(홈 대표 제품과 동일 방식): 설정 행이 없거나 비면 기본 주소를 쓴다.
 *        조회가 실패하면 빈 문자열을 돌려주고, 그 경우 버튼은 아예 그리지 않는다
 *        (눌러도 아무 데도 안 가는 버튼 금지).
 */

/** front_settings 키 — 관리자 → 설정 → 일반 설정에서 편집한다 */
export const TRIAL_APPLY_URL_KEY = 'trial_apply_url'

/** 설정이 비었을 때 쓰는 기본 신청 주소(구글 폼 — 2026-08-16 대표님 확정) */
export const TRIAL_APPLY_URL_DEFAULT =
  'https://docs.google.com/forms/d/e/1FAIpQLSfBv9v_TOpPv4sgBBZLdD4qIG9DJjcHn_9-Nya8CNTiftgR-w/viewform?usp=header'

/**
 * @함수명: fetchTrialApplyUrl
 * @설명: 관리자 설정에서 체험 신청 주소를 읽습니다. 행이 없거나 값이 비면 기본 주소,
 *        조회 실패 시에만 빈 문자열(버튼 숨김 신호)을 돌려줍니다.
 * @매개변수: client - 서버용 Supabase 클라이언트
 * @반환값: 신청 주소(정상) 또는 ''(조회 실패 — 버튼을 그리지 않는다)
 */
export async function fetchTrialApplyUrl(client: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await client
      .from('front_settings')
      .select('value')
      .eq('key', TRIAL_APPLY_URL_KEY)
      .maybeSingle()
    if (error) return ''
    return (data?.value ?? '').trim() || TRIAL_APPLY_URL_DEFAULT
  } catch {
    return ''
  }
}
