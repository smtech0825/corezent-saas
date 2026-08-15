'use server'

/**
 * @파일: admin/org-license/actions.ts
 * @설명: 기관 라이선스 「바로 발급」 서버 액션(Wave 2).
 *        ★ 쓰는 곳은 앱 DB(지니워크 라이선스 전용 Supabase)뿐이다 — 웹사이트 DB(본체)에는
 *          작업 기록(admin_activity_log) 한 줄 외에 아무것도 쓰지 않는다.
 *        발급은 008의 DB 함수(issue_org_license) 한 번 호출 — 두 표(license_keys·
 *        gw_org_licenses)가 한 트랜잭션이라 한쪽만 써지는 경우가 없다.
 *        값 해석·검증은 전부 _lib/orgLicenseSql.ts(정본 이식) — 여기서 재계산 금지.
 */

import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { licenseClientFor } from '@/app/api/license/_lib_supabase'
import { logAdminActivity, currentUserIdForLog } from '@/lib/adminActivityLog'
import { maskSecret, maskSecretsInText } from '@/lib/mask'
import { type OrgLicenseInput, validateInput, n } from './_lib/orgLicenseSql'
import { toRpcArgs } from './_lib/orgLicenseRpc'

/** RPC 오류 코드별 한국어 안내 — 운영자가 조치를 고를 수 있게(코드는 함께 표기) */
const RPC_ERROR_HINTS: Record<string, string> = {
  '23514': '대수(tier) 제약에 걸렸습니다. 앱 DB의 tier 제약(1~4자리+pc)을 확인해 주세요.',
  '22P02': '숫자 형식이 맞지 않습니다. 금액·개월·PC 수에 소수나 문자가 없는지 확인해 주세요.',
  '42501': '함수 실행 권한이 없습니다. 008 SQL의 권한 부여(GRANT)가 실행됐는지 확인해 주세요.',
  'PGRST202': '발급 함수를 찾지 못했습니다. 008 SQL 실행 여부와 스키마 캐시 갱신을 확인해 주세요.',
}

/** 발급 성공 후 화면에 보여줄 확인값 — DB에서 실제로 다시 읽은 값(별표는 실측) */
export interface IssueResult {
  /** license_keys에 실제 등록된 tier(예: '30pc') */ tier: string | null
  /** license_keys에 실제 등록된 만료 시각(ISO) */ expiresAt: string | null
  /** gw_org_licenses에 실제 등록된 기관명 */ orgName: string | null
  /** gw_org_licenses에 실제 등록된 계약 PC 수 */ pcCount: number | null
  /** 서버 계산 함수(gw_org_monthly_limit)가 돌려준 이번 달 한도 — 함수 호출이 실패하면 null(화면은 검산값+확인 SQL로 폴백) */
  serverMonthlyLimit: number | null
}

/**
 * @함수명: issueOrgLicense
 * @설명: 미리보기·확인을 거친 뒤에만 호출됩니다. 같은 키가 이미 있으면 발급을 거부하고,
 *        발급 후 두 표에서 실제 값을 다시 읽어 돌려줍니다(확인 표시용).
 *        작업 기록에는 라이선스 키 앞부분만 남깁니다(전체 금지).
 * @매개변수: input - 화면 입력 18칸(문자열 그대로)
 * @반환값: ok(확인값) / forbidden / failed(한국어 사유)
 */
export async function issueOrgLicense(input: OrgLicenseInput): Promise<AdminActionResult<IssueResult>> {
  const denied = await guardAdmin()
  if (denied) return denied

  // 정본과 같은 검증 — 오류가 하나라도 있으면 발급하지 않는다(SQL 만들기와 동일 기준)
  const errs = validateInput(input).filter((m) => m.kind === 'err')
  if (errs.length > 0) {
    return { status: 'failed', reason: `입력에 오류가 ${errs.length}곳 있습니다. 화면의 붉은 표시를 먼저 고쳐 주세요.` }
  }

  // 정수 확인 — SQL 복사 경로는 DB가 소수를 반올림해 통과시키지만 함수 호출 경로는
  // 형식 오류로 실패해 두 갈래의 결과가 갈린다(검증 지적). 발급 경로에서만 명시적으로 막는다
  // (정본 화면·SQL 생성은 불변).
  for (const f of ['pc_count', 'base_package_krw', 'extra_package_krw', 'extra_months_left'] as const) {
    const num = n(input, f)
    if (num !== Math.floor(num)) {
      return { status: 'failed', reason: '금액·개월·PC 수는 정수만 넣을 수 있습니다(소수 불가).' }
    }
  }

  const key = input.license_key.trim()
  let gw: ReturnType<typeof licenseClientFor>
  try {
    gw = licenseClientFor('geniework')
  } catch (err) {
    console.error('[org-license] 앱 DB 접속 실패:', err instanceof Error ? err.message : String(err))
    return { status: 'failed', reason: '앱 DB 접속 정보가 없습니다. 운영 환경 설정(GW_SUPABASE_*)을 확인해 주세요.' }
  }

  // 같은 키 선확인(원본 안내: "등록 전에 키를 조회하십시오") — DB 유일 제약이 최종 방어
  const { data: existing, error: checkErr } = await gw
    .from('license_keys').select('id').eq('license_key', key).maybeSingle()
  if (checkErr) return dbFailure('발급 전 키 확인', checkErr)
  if (existing) {
    return { status: 'failed', reason: '이미 등록된 라이선스 키입니다. 키를 바꾸거나 기존 등록을 확인해 주세요.' }
  }

  // 발급 — 008 함수 한 번 호출(두 표 한 트랜잭션). 값 규칙은 등록 SQL과 동일(toRpcArgs)
  const { error: issueErr } = await gw.rpc('issue_org_license', toRpcArgs(input))
  if (issueErr) {
    const code = (issueErr as { code?: string }).code ?? ''
    if (code === '23505') {
      return { status: 'failed', reason: '이미 등록된 라이선스 키입니다(동시 발급 감지). 아무것도 만들어지지 않았습니다.' }
    }
    console.error('[org-license] 발급 실패:', maskSecretsInText(String(issueErr.message)))

    // "아무것도 안 만들어졌다"는 DB가 거부했을 때만 참이다 — 네트워크 끊김·시간 초과라면
    // 실제로는 이미 등록됐을 수 있다(검증 지적). 한 번 더 조회해 실상을 가려 안내한다.
    try {
      const { data: after } = await gw.from('license_keys').select('id').eq('license_key', key).maybeSingle()
      if (after) {
        return {
          status: 'failed',
          reason: '응답이 끊겼지만 발급은 이미 완료됐을 수 있습니다 — 실제로 키가 조회됩니다. 다시 발급하지 말고 5번의 「확인 SQL」로 값을 대조해 주세요.',
        }
      }
    } catch { /* 재조회도 실패 — 아래 일반 안내 */ }

    const hint = RPC_ERROR_HINTS[code]
    return {
      status: 'failed',
      reason: hint
        ? `발급에 실패했습니다(${code}). ${hint} 아무것도 만들어지지 않았습니다.`
        : `발급에 실패했습니다${code ? `(${code})` : ''}. 아무것도 만들어지지 않았습니다(두 표는 한 묶음). 잠시 후 다시 시도해 주세요.`,
    }
  }

  // 작업 기록(본체 DB) — 키는 앞 8자만. 기록 실패가 발급을 막지 않는다(공용 규칙)
  try {
    const actor = await currentUserIdForLog()
    if (actor) {
      await logAdminActivity({
        adminUserId: actor,
        action: 'org_license.issue',
        targetType: 'license',
        targetId: maskSecret(key, 8),
        detail: {
          org_name: input.org_name.trim(),
          pc_count: input.pc_count.trim(),
          contract: `${input.contract_start.trim()} ~ ${input.contract_end.trim()}`,
          base_package_krw: input.base_package_krw.trim(),
          extra_package_krw: input.extra_package_krw.trim(),
        },
      })
    }
  } catch { /* 기록 실패는 발급을 막지 않는다 */ }

  // 발급 후 확인 — 두 표에서 실제 값을 다시 읽는다(조회 실패해도 발급은 이미 성공)
  const result: IssueResult = { tier: null, expiresAt: null, orgName: null, pcCount: null, serverMonthlyLimit: null }
  try {
    const [lk, org] = await Promise.all([
      gw.from('license_keys').select('tier, expires_at').eq('license_key', key).maybeSingle(),
      gw.from('gw_org_licenses').select('org_name, pc_count').eq('license_key', key).maybeSingle(),
    ])
    result.tier = (lk.data?.tier as string) ?? null
    result.expiresAt = (lk.data?.expires_at as string) ?? null
    result.orgName = (org.data?.org_name as string) ?? null
    result.pcCount = (org.data?.pc_count as number) ?? null
  } catch { /* 확인 조회 실패 — 화면은 확인 SQL 안내로 폴백 */ }

  // 서버 계산 함수로 한도 확인 시도 — 정본 확인 SQL의 핵심(앱이 실제로 보는 값과 대조).
  // 이 함수는 대표님이 DB에서 직접 만든 것이라 인자 이름을 저장소에서 알 수 없다 —
  // 통상 이름(license_key)으로 한 번 시도하고, 실패하면 null(화면이 확인 SQL로 안내).
  try {
    const { data: lim, error: limErr } = await gw.rpc('gw_org_monthly_limit', { license_key: key })
    if (!limErr && typeof lim === 'number') result.serverMonthlyLimit = lim
  } catch { /* 읽기 시도일 뿐 — 실패해도 무해 */ }

  return { status: 'ok', created: result }
}
