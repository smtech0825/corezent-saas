/**
 * @파일: admin/org-license/_lib/orgLicenseSql.ts
 * @설명: 기관 라이선스 발급 — 계산·검증·SQL 세 벌 생성의 단일 출처.
 *        ⚠️ 정본은 prompts/기관라이선스_발급_DB.html — 대표님이 실제로 쓰시는 파일이다.
 *        계산식·SQL 문장을 "글자 단위로 그대로" 옮겼다(검증 하네스로 3케이스 대조).
 *        절대 "더 낫게" 고치지 말 것 — 값이 하나라도 달라지면 실패다.
 *        화면(SQL 만들기)과 Wave 2의 바로 발급·미리보기가 전부 이 모듈만 쓴다(사본 금지).
 *        이 모듈은 순수 계산만 한다 — DB에 읽고 쓰는 코드가 없다.
 */

/** 문서 1장당 AI 원가(원). 근거 = 원본 파일 주석(35개 기능 단순평균 97.2원) */
export const DOC_COST = 97.2
/** 앱 라이선스 PC 1대 연 단가(원). 근거 = 원본 파일 주석(CLAUDE.md License 항목) */
export const APP_UNIT = 79000

/** 입력 18칸 — 원본 IDS와 동일. 전부 문자열(원본이 input.value 기반이라 동일성 보장) */
export interface OrgLicenseInput {
  license_key: string
  org_name: string
  biz_reg_no: string
  contact_name: string
  contact_phone: string
  contact_email: string
  contract_doc_no: string
  pc_count: string
  contract_start: string
  contract_end: string
  base_package_krw: string
  extra_package_krw: string
  extra_months_left: string
  credit_start_month: string
  ai_workspace_id: string
  workspace_limit_usd: string
  fx_krw_per_usd: string
  issuer_note: string
}

/** 필수 10칸 — 원본 REQ와 동일 */
export const REQUIRED_FIELDS = [
  'license_key', 'org_name', 'pc_count', 'contract_start', 'contract_end',
  'base_package_krw', 'extra_package_krw', 'extra_months_left', 'credit_start_month', 'fx_krw_per_usd',
] as const

// ─── 원본의 기초 함수들(그대로) ──────────────────────────────────────────────
function v(input: OrgLicenseInput, key: keyof OrgLicenseInput): string {
  return (input[key] ?? '').trim()
}
function n(input: OrgLicenseInput, key: keyof OrgLicenseInput): number {
  const x = parseFloat(v(input, key))
  return isNaN(x) ? 0 : x
}
/** 원본 won() — 반올림 + 한국식 쉼표 + '원' */
export function won(x: number): string {
  return Math.round(x).toLocaleString('ko-KR') + '원'
}
/** 원본 q() — SQL 문자열 이스케이프(작은따옴표 두 개로) */
function q(s: string): string {
  return "'" + String(s).replace(/'/g, "''") + "'"
}
function p2(x: number): string { return (x < 10 ? '0' : '') + x }
/** 원본 ymd() — 반드시 이 PC(한국) 기준. toISOString은 하루 어긋난다(원본 주석) */
export function ymd(d: Date): string {
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())
}

// ─── 빠른 채우기 도우미(원본 그대로) ────────────────────────────────────────
/** 원본 genKey() — GW-ORG-연도-네자리 난수 */
export function genKey(): string {
  const y = new Date().getFullYear()
  const r = Math.floor(Math.random() * 9000 + 1000)
  return 'GW-ORG-' + y + '-' + r
}
/** 원본 setNextMonth() — 달을 직접 더하면 말일에 두 달 뒤로 튄다. 연·월만 세어 1일 */
export function nextMonthFirst(): string {
  const d = new Date(); let y = d.getFullYear(); let m = d.getMonth() + 1
  if (m === 12) { y += 1; m = 1 } else { m += 1 }
  return y + '-' + p2(m) + '-01'
}
/** 원본 setOneYear() — 1년 뒤 같은 날의 하루 전 = 만 1년 */
export function oneYearEnd(start: string): string {
  if (!start) return ''
  const a = start.split('-')
  const d = new Date(parseInt(a[0], 10) + 1, parseInt(a[1], 10) - 1, parseInt(a[2], 10))
  d.setDate(d.getDate() - 1)
  return ymd(d)
}

// ─── 검증(원본 run()의 규칙 그대로) ─────────────────────────────────────────
export interface FieldMark { field: keyof OrgLicenseInput; msg: string; kind: 'err' | 'warn' }

/**
 * @함수명: validateInput
 * @설명: 원본 run()의 오류·경고 규칙을 그대로 적용합니다(문구 포함 동일).
 * @반환값: 표시할 표식 목록 — kind 'err'가 하나라도 있으면 SQL을 만들지 않는다
 */
export function validateInput(input: OrgLicenseInput): FieldMark[] {
  const marks: FieldMark[] = []
  const err = (field: keyof OrgLicenseInput, msg: string) => marks.push({ field, msg, kind: 'err' })
  const warn = (field: keyof OrgLicenseInput, msg: string) => marks.push({ field, msg, kind: 'warn' })

  REQUIRED_FIELDS.forEach((f) => { if (v(input, f) === '') err(f, '반드시 채워야 합니다') })

  if (v(input, 'license_key') && v(input, 'license_key').length < 8) err('license_key', '8자 이상이어야 합니다')
  const pc = n(input, 'pc_count')
  if (v(input, 'pc_count') !== '' && (pc < 1 || pc !== Math.floor(pc))) err('pc_count', '1 이상 정수여야 합니다')
  // 등록 대수(tier)는 서버에서 네 자리까지만 받는다(원본 주석 — 운영 DB CHECK: ^[0-9]{1,4}pc$)
  else if (pc > 9999) err('pc_count', '9,999 이하여야 합니다')

  const cm = v(input, 'credit_start_month')
  if (cm && !/^\d{4}-\d{2}$/.test(cm)) err('credit_start_month', 'YYYY-MM 형식이어야 합니다 (월은 두 자리)')
  else if (cm && (parseInt(cm.slice(5), 10) < 1 || parseInt(cm.slice(5), 10) > 12)) {
    err('credit_start_month', '달은 01~12 사이여야 합니다')
  }

  const cs = v(input, 'contract_start'); const ce = v(input, 'contract_end')
  if (cs && ce && ce <= cs) err('contract_end', '시작일보다 뒤여야 합니다')

  if (v(input, 'fx_krw_per_usd') !== '' && n(input, 'fx_krw_per_usd') <= 0) err('fx_krw_per_usd', '0보다 커야 합니다')
  if (v(input, 'workspace_limit_usd') !== '' && n(input, 'workspace_limit_usd') < 0) err('workspace_limit_usd', '0 이상이어야 합니다')

  const base = n(input, 'base_package_krw')
  if (v(input, 'base_package_krw') !== '' && base < 0) err('base_package_krw', '0 이상이어야 합니다')
  else if (base > 0 && base < 1000000) warn('base_package_krw', '월 금액을 넣으신 것은 아닙니까? 연 총액입니다')

  const extra = n(input, 'extra_package_krw'); const months = n(input, 'extra_months_left')
  if (v(input, 'extra_package_krw') !== '' && extra < 0) err('extra_package_krw', '0 이상이어야 합니다')
  if (v(input, 'extra_months_left') !== '' && months < 0) err('extra_months_left', '0 이상이어야 합니다')
  else if (extra > 0 && months < 1) err('extra_months_left', '추가 패키지가 있으면 1 이상이어야 합니다')
  else if (extra === 0 && months > 0) warn('extra_months_left', '추가 패키지가 0인데 개월이 들어 있습니다')

  if (!v(input, 'contact_email')) warn('contact_email', '비우면 한도 알림을 보낼 곳이 없습니다')
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v(input, 'contact_email'))) err('contact_email', '메일 형식이 아닙니다')

  return marks
}

// ─── 검산(원본 계산 그대로 — 나눗셈마다 소수점 버림) ────────────────────────
export interface OrgLicensePreview {
  /** 이번 달 한도(원) */ limit: number
  /** 1인당 이번 달 몫(원) */ per: number
  /** 1인당 월 문서 수(장) */ docs: number
  /** 등록될 대수 문자열(예: '30pc') */ tier: string
  /** 만료 시각 문구(예: '2027-08-15 23:59:59') */ exp: string
  /** 연 견적(참고, 원) */ quote: number
}

/**
 * @함수명: calcPreview
 * @설명: 검산 값을 계산합니다 — 서버 함수(gw_org_monthly_limit)와 똑같이 나눗셈마다
 *        소수점을 버립니다(반올림 금지 — 원본 주석: 1원 어긋남 방지).
 */
export function calcPreview(input: OrgLicenseInput): OrgLicensePreview {
  const base = n(input, 'base_package_krw')
  const extra = n(input, 'extra_package_krw')
  const months = n(input, 'extra_months_left')
  const pc = n(input, 'pc_count')
  const ce = v(input, 'contract_end')
  const limit = Math.floor(base / 12) + (months > 0 ? Math.floor(extra / months) : 0)
  const per = pc > 0 ? Math.floor(limit / pc) : 0
  return {
    limit,
    per,
    docs: Math.floor(per / DOC_COST),
    tier: pc ? pc + 'pc' : '',
    exp: ce ? ce + ' 23:59:59' : '',
    quote: pc && base ? pc * APP_UNIT + base : 0,
  }
}

// ─── SQL 세 벌(원본 buildSql 그대로 — 문자열 연결 형태까지 유지) ────────────
/**
 * @함수명: buildRegisterSql
 * @설명: 등록 SQL — 원본과 글자 단위 동일(BEGIN~COMMIT 한 묶음, 두 표에 함께 쓴다).
 *        ⚠️ 문장을 고치지 말 것. 발급 함수 SQL(008)도 이 문장을 그대로 담는다.
 */
export function buildRegisterSql(input: OrgLicenseInput, limit: number, per: number): string {
  return (
'-- ═══ 기관 라이선스 등록 ═══\n'+
'-- ★ 지니워크 라이선스 프로젝트 ecltbezstxufivhbhsjp 에서 실행하십시오.\n'+
'--   지니스톡 vpwmaqrqwpwfdsvseqvb 이 아닙니다 — 두 프로젝트에 같은 이름의 표가 있습니다.\n'+
'-- 실행 전 확인 : 이번 달 한도 '+won(limit)+' · 1인당 '+won(per)+'\n'+
'BEGIN;\n\n'+
'WITH 입력값 AS (\n'+
'  SELECT\n'+
'    '+q(v(input,'license_key'))+'::text AS license_key,\n'+
'    '+q(v(input,'org_name'))+'::text AS org_name,\n'+
'    '+q(v(input,'biz_reg_no'))+'::text AS biz_reg_no,\n'+
'    '+q(v(input,'contact_name'))+'::text AS contact_name,\n'+
'    '+q(v(input,'contact_phone'))+'::text AS contact_phone,\n'+
'    '+q(v(input,'contact_email'))+'::text AS contact_email,\n'+
'    '+q(v(input,'contract_doc_no'))+'::text AS contract_doc_no,\n'+
'    '+n(input,'pc_count')+'::int AS pc_count,\n'+
'    '+q(v(input,'contract_start'))+'::date AS contract_start,\n'+
'    '+q(v(input,'contract_end'))+'::date AS contract_end,\n'+
'    '+n(input,'base_package_krw')+'::bigint AS base_package_krw,\n'+
'    '+n(input,'extra_package_krw')+'::bigint AS extra_package_krw,\n'+
'    '+n(input,'extra_months_left')+'::int AS extra_months_left,\n'+
'    '+q(v(input,'credit_start_month'))+'::text AS credit_start_month,\n'+
'    '+q(v(input,'ai_workspace_id'))+'::text AS ai_workspace_id,\n'+
'    '+(v(input,'workspace_limit_usd')===''?'NULL':n(input,'workspace_limit_usd'))+'::numeric AS workspace_limit_usd,\n'+
'    '+n(input,'fx_krw_per_usd')+'::numeric AS fx_krw_per_usd,\n'+
'    '+q(v(input,'issuer_note'))+'::text AS issuer_note\n'+
'),\n'+
'-- 아래부터는 고치지 않는다 ─────────────────────────────────────\n'+
'라이선스_등록 AS (\n'+
'  INSERT INTO license_keys\n'+
'    (license_key, tier, source, buyer_email, expires_at, is_active, product)\n'+
'  SELECT\n'+
'    license_key,\n'+
"    pc_count || 'pc',\n"+
"    'manual',\n"+
"    NULLIF(contact_email, ''),\n"+
"    (contract_end + 1) AT TIME ZONE 'Asia/Seoul' - INTERVAL '1 second',\n"+
'    TRUE,\n'+
"    'geniework'\n"+
'  FROM 입력값\n'+
'  RETURNING license_key\n'+
')\n'+
'INSERT INTO gw_org_licenses (\n'+
'  license_key, org_name, biz_reg_no,\n'+
'  contact_name, contact_phone, contact_email, contract_doc_no,\n'+
'  pc_count, contract_start, contract_end, status,\n'+
'  base_package_krw, extra_package_krw, extra_months_left, extra_base_month,\n'+
'  credit_start_month, ai_workspace_id, workspace_limit_usd, fx_krw_per_usd, issuer_note\n'+
')\n'+
'SELECT\n'+
"  license_key, org_name, NULLIF(biz_reg_no, ''),\n"+
"  NULLIF(contact_name, ''), NULLIF(contact_phone, ''), NULLIF(contact_email, ''), NULLIF(contract_doc_no, ''),\n"+
"  pc_count, contract_start, contract_end, 'active',\n"+
'  base_package_krw, extra_package_krw, extra_months_left,\n'+
"  to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM'),\n"+
"  credit_start_month, NULLIF(ai_workspace_id, ''), workspace_limit_usd, fx_krw_per_usd, NULLIF(issuer_note, '')\n"+
'FROM 입력값;\n\n'+
'COMMIT;'
  )
}

/**
 * @함수명: buildCheckSql
 * @설명: 등록 직후 확인 SQL — 원본과 글자 단위 동일.
 */
export function buildCheckSql(input: OrgLicenseInput): string {
  return (
'-- 한도는 서버 계산 함수로 뽑는다 = 앱이 실제로 보게 될 값과 같다.\n'+
'-- 아래 두 숫자가 이 화면 맨 위 검산과 똑같이 나와야 한다.\n'+
'SELECT o.org_name,\n'+
'       l.tier                        AS "등록된 PC 대수",\n'+
'       o.pc_count                    AS "계약 PC 수",\n'+
"       l.expires_at AT TIME ZONE 'Asia/Seoul' AS \"만료(한국시간)\",\n"+
'       o.fx_krw_per_usd              AS "환율",\n'+
'       gw_org_monthly_limit(l.license_key)              AS "이번 달 한도",\n'+
'       gw_org_monthly_limit(l.license_key) / o.pc_count AS "1인당 이번 달 몫",\n'+
'       (SELECT COUNT(*) FROM hwid_mapping h WHERE h.license_key = l.license_key) AS "등록된 PC 수"\n'+
'FROM license_keys l\n'+
'JOIN gw_org_licenses o USING (license_key)\n'+
'WHERE l.license_key = '+q(v(input,'license_key'))+';'
  )
}

/**
 * @함수명: buildTopupSql
 * @설명: 추가 패키지 충전 SQL — 원본과 글자 단위 동일. ⚠️ 자동 실행 금지 — 복사만 제공.
 */
export function buildTopupSql(input: OrgLicenseInput): string {
  return (
'-- ═══ 추가 패키지 충전 ═══\n'+
'-- ★ 지니워크 라이선스 프로젝트 ecltbezstxufivhbhsjp 에서 실행하십시오.\n'+
'UPDATE gw_org_licenses\n'+
'SET extra_package_krw = '+n(input,'extra_package_krw')+',\n'+
'    extra_months_left = '+n(input,'extra_months_left')+',\n'+
"    extra_base_month  = to_char(now() AT TIME ZONE 'Asia/Seoul','YYYY-MM'),\n"+
'    updated_at        = now()\n'+
'WHERE license_key = '+q(v(input,'license_key'))+';'
  )
}
