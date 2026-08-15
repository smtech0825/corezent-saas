import { createAdminClient } from '@/lib/supabase/admin'
import { fetchManualFileUrl } from '@/lib/manual'

/**
 * @파일: app/manual/route.ts
 * @설명: 사용설명서 중계 통로 — 저장소의 설명서 HTML 파일을 한 글자도 고치지 않고
 *        그대로 화면으로 내보낸다(저장소 직접 주소는 HTML을 글자로만 보여주는 정책이라
 *        이 통로가 필요 — 2026-08-16 실측). 로그인 불필요: 주소만 알면 누구나.
 *        ⚠️ 주소 조작 차단: 이 통로는 사용자 입력(쿼리·경로 파라미터)을 아예 받지 않고,
 *        관리자 설정값도 우리 저장소 공개 경로만 통과시킨다(lib/manual.ts의 잠금).
 *        파일이 없거나 못 읽으면 화면이 깨지는 대신 한국어 안내를 내보낸다.
 */

export const dynamic = 'force-dynamic'

/** 파일이 없거나 못 읽을 때의 안내 화면(내용이 짧아 문자열로 유지 — 색 지정 없음, 기본색) */
const NOT_READY_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>사용설명서</title></head>
<body style="font-family:sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<p>사용설명서를 아직 준비 중입니다. 잠시 후 다시 시도해 주세요.</p>
</body></html>`

/**
 * @함수명: GET
 * @설명: 설정된 설명서 파일을 그대로 내보냅니다(무수정). 5분 캐시로 재방문을 빠르게 합니다.
 * @반환값: text/html 응답 — 설명서 원문 또는 준비 중 안내(404)
 */
export async function GET() {
  // 클라이언트 생성 실패(환경 변수 누락 등)도 500 대신 준비 중 안내로 — 손님 화면은 깨지지 않는다
  let url = ''
  try {
    url = await fetchManualFileUrl(createAdminClient())
  } catch { /* url '' → 아래 안내 */ }
  if (!url) {
    return new Response(NOT_READY_HTML, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  try {
    // 리다이렉트 금지(검증한 주소 밖으로 새는 것 차단) + 10초 제한(저장소가 멈추면 안내로)
    const res = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`storage ${res.status}`)
    // 바이트 그대로 전달 — 내용 무수정. 문자셋은 문서 안의 <meta charset>이 결정하도록
    // 헤더에는 형식만 적는다(헤더 문자셋이 문서 선언을 덮어써 깨지는 일 방지)
    const body = await res.arrayBuffer()
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        // 브라우저·CDN 5분 기억 — 900KB를 매번 다시 받지 않는다. 파일 교체는 5분 안에 반영
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        // 심층 방어 — 설명서는 스크립트 없는 정적 문서(실측)라 sandbox를 걸어도 그대로 보이고,
        // 만에 하나 악성 HTML이 올라와도 스크립트 실행·쿠키 접근이 원천 차단된다
        'Content-Security-Policy': 'sandbox',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    // 저장소 문제(파일 삭제·장애)는 서버 기록으로 표면화하고 손님에게는 안내만
    console.error('[manual] 설명서 파일을 읽지 못했습니다:', err instanceof Error ? err.message : String(err))
    return new Response(NOT_READY_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
}
