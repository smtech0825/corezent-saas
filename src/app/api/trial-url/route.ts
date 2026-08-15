import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchTrialApplyUrl } from '@/lib/trial'

/**
 * @파일: api/trial-url/route.ts
 * @설명: 무료 체험 신청 주소 공개 조회 — 체험 신청 버튼(TrialApplyButton)이 읽는다.
 *        front_settings는 RLS로 익명 조회가 막혀 있어(비밀번호·계좌 등 비밀 키 보호)
 *        클라이언트가 직접 못 읽는다 — 이 라우트가 체험 주소 "키 하나만" 골라 돌려준다.
 *        ⚠️ 다른 설정 키를 여기에 추가하지 말 것(공개 표면 최소 유지).
 *        인증 불필요(공개 버튼용) · 쓰기 없음(GET 전용) · 실패 시 url ''(버튼 숨김).
 */

export const dynamic = 'force-dynamic'

/**
 * @함수명: GET
 * @설명: 체험 신청 주소 한 개를 { url } 형태로 돌려줍니다. 값이 비면 버튼이 숨겨집니다.
 * @반환값: { url: string } — 주소 또는 ''(숨김)
 */
export async function GET() {
  const url = await fetchTrialApplyUrl(createAdminClient())
  return NextResponse.json(
    { url },
    // CDN·브라우저 60초 캐시 — 관리자가 주소를 바꾸면 1분 안에 반영된다(호출량 최소화)
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } },
  )
}
