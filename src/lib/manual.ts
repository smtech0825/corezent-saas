import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * @파일: lib/manual.ts
 * @설명: 사용설명서 파일 주소 공용 헬퍼 — 관리자 설정(front_settings)에서 읽는다.
 *        저장소(Supabase Storage)는 HTML을 화면으로 그려주지 않으므로(2026-08-16 실측)
 *        손님에게는 중계 통로(/manual)가 파일을 그대로 내보낸다.
 *        ⚠️ 주소를 코드에 박지 말 것 — 대표님이 관리자에서 파일을 바꾸면 그대로 반영돼야 한다.
 *        ⚠️ 안전 규칙: 우리 저장소의 공개 경로로 시작하는 주소만 유효로 인정한다 —
 *        중계 통로가 외부 사이트를 대신 퍼 나르는 창구가 되지 않게 하는 잠금.
 */

/** front_settings 키 — 관리자 → 설정 → 일반 설정에서 파일을 올리면 채워진다 */
export const MANUAL_FILE_URL_KEY = 'manual_file_url'

/**
 * @함수명: isAllowedManualUrl
 * @설명: 설명서 주소가 우리 저장소의 공개 파일 주소인지 확인합니다.
 *        비공개 보관함은 공개 경로로 나오지 않으므로 이 검사로 유출 경로도 함께 막힙니다.
 * @매개변수: url - 검사할 주소
 * @반환값: 우리 저장소 공개 경로면 true
 */
export function isAllowedManualUrl(url: string): boolean {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  if (!base) return false
  return url.startsWith(`${base}/storage/v1/object/public/`)
}

/**
 * @함수명: fetchManualFileUrl
 * @설명: 관리자 설정에서 설명서 파일 주소를 읽습니다. 값이 없거나 비었거나
 *        우리 저장소 공개 경로가 아니면 빈 문자열(버튼·중계 모두 "없음" 처리).
 * @매개변수: client - 서버용 Supabase 클라이언트
 * @반환값: 파일 주소(정상) 또는 ''(버튼을 그리지 않고, 중계는 안내를 내보낸다)
 */
export async function fetchManualFileUrl(client: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await client
      .from('front_settings')
      .select('value')
      .eq('key', MANUAL_FILE_URL_KEY)
      .maybeSingle()
    if (error) return ''
    const url = String(data?.value ?? '').trim()
    return isAllowedManualUrl(url) ? url : ''
  } catch {
    return ''
  }
}
