/**
 * @파일: lib/licenseResetLog.ts
 * @설명: /api/license/reset 호출을 기록하는 모니터링 로그(fix-corezent-security-wave.md
 *        Wave 4, 옵션 3 — 로그인/소유권 검증 없이 관찰만). GeniePost(Sheets)·GenieStock·
 *        GenieWork 세 경로가 공유하는 reset/route.ts 진입점에서 제품·성공여부 무관하게
 *        호출 즉시 기록한다. best-effort — 기록 실패가 실제 reset을 막지 않는다.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type LicenseResetProduct = 'geniepost' | 'geniestock' | 'geniework'

/**
 * @함수명: logLicenseReset
 * @설명: 라이선스 reset 호출 한 건을 기록합니다. 실패해도 조용히 넘어갑니다.
 * @매개변수: params - licenseKey/product/ip
 * @반환값: 없음(항상 resolve)
 */
export async function logLicenseReset(params: {
  licenseKey: string
  product: LicenseResetProduct
  ip: string
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('license_reset_log').insert({
      license_key: params.licenseKey,
      product: params.product,
      ip_address: params.ip,
    })
  } catch {
    // best-effort — 기록 실패는 무시(테이블 미적용/DB 오류 등)
  }
}
