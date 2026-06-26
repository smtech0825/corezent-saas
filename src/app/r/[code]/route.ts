/**
 * @파일: app/r/[code]/route.ts
 * @설명: 추천 링크 진입점 — cz_ref 쿠키 저장(last-click) + 클릭 기록 후 홈으로 리다이렉트.
 *        쿠키 수명은 affiliate_program_config.cookie_days(DB)에서 읽는다(하드코딩 금지).
 *        클릭 기록은 비로그인 방문자도 가능해야 하므로 admin 클라이언트(service_role)로 INSERT.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAffiliateConfig, normalizeRefCode, hashIp, REF_COOKIE } from '@/lib/affiliate'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params
  const code = normalizeRefCode(rawCode)
  const origin = new URL(request.url).origin
  const res = NextResponse.redirect(`${origin}/`)

  // 빈/이상 코드는 그냥 홈으로
  if (!code) return res

  try {
    const cfg = await getAffiliateConfig()

    // 마스터 스위치: 설정 미시드/프로그램 비활성이면 아무것도 하지 않고 홈으로
    if (!cfg || !cfg.program_enabled) return res

    // last-click 귀속: 새 ref가 오면 덮어씀. 쿠키 수명은 설정값에서만 결정.
    // 서버(가입 콜백)에서만 소비하므로 httpOnly로 클라이언트 변조 차단.
    if (cfg.cookie_days != null) {
      res.cookies.set(REF_COOKIE, code, {
        maxAge: cfg.cookie_days * 24 * 60 * 60,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    }

    // 클릭 기록 (분석·어뷰징). 원본 IP는 저장하지 않고 해시만.
    const admin = createAdminClient()
    const ipRaw = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    await admin.from('affiliate_clicks').insert({
      referral_code: code,
      landing_path: `/r/${code}`,
      ip_hash: hashIp(ipRaw),
      user_agent: request.headers.get('user-agent') ?? null,
    })
  } catch (err) {
    console.error('[affiliate] 클릭 기록 실패:', err)
  }

  return res
}
