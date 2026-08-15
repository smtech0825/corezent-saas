/**
 * @파일: admin/org-license/_lib/orgLicenseFields.ts
 * @설명: 기관 라이선스 발급 화면의 표시 데이터 — 입력 칸 정의(라벨·안내문·자리표시)와
 *        "잘못 넣기 쉬운 자리" 표. 문구는 정본(prompts/기관라이선스_발급_DB.html) 그대로다.
 *        계산·SQL은 orgLicenseSql.ts 가 담당한다(여긴 순수 표시 데이터만).
 */

import type { OrgLicenseInput } from './orgLicenseSql'

/** 빠른 채우기 버튼 한 개 — action은 화면(OrgIssueClient)이 해석한다 */
export interface FieldChip {
  label: string
  action:
    | { type: 'set'; value: string }
    | { type: 'genKey' }
    | { type: 'today' }
    | { type: 'nextMonth' }
    | { type: 'oneYear' }
    | { type: 'syncMonth' }
}

/** 입력 칸 한 개의 표시 정의 */
export interface FieldDef {
  key: keyof OrgLicenseInput
  label: string
  required?: boolean
  type?: 'text' | 'number' | 'date'
  placeholder?: string
  hint?: string
  chips?: FieldChip[]
}

/** 섹션별 입력 칸 — 원본의 1·2·3 섹션 그대로(항목·순서·문구 동일) */
export const FIELD_SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: '1. 기관 정보',
    fields: [
      { key: 'license_key', label: '라이선스 키', required: true, placeholder: 'GW-ORG-2026-0001',
        hint: '8자 이상 · 기관마다 유일해야 합니다', chips: [{ label: '자동 만들기', action: { type: 'genKey' } }] },
      { key: 'org_name', label: '기관명', required: true, placeholder: '○○시청' },
      { key: 'biz_reg_no', label: '사업자등록번호', placeholder: '123-45-67890', hint: '계약서에 적힌 그대로 넣으십시오' },
      { key: 'contract_doc_no', label: '계약 문서 번호', placeholder: '2026-계약-0142' },
      { key: 'contact_name', label: '담당자 이름', placeholder: '홍길동' },
      { key: 'contact_phone', label: '담당자 연락처', placeholder: '02-000-0000' },
      { key: 'contact_email', label: '담당자 메일', placeholder: 'xxx@korea.kr', hint: '비우면 한도 알림을 보낼 곳이 없습니다' },
      { key: 'issuer_note', label: '발급자 메모', placeholder: '2026년 본예산 · 신규' },
    ],
  },
  {
    title: '2. 계약',
    fields: [
      { key: 'pc_count', label: 'PC 수', required: true, type: 'number',
        hint: '1 ~ 9,999 · 이 값으로 등록 대수가 자동으로 정해집니다',
        chips: [
          { label: '10', action: { type: 'set', value: '10' } },
          { label: '30', action: { type: 'set', value: '30' } },
          { label: '50', action: { type: 'set', value: '50' } },
          { label: '100', action: { type: 'set', value: '100' } },
        ] },
      { key: 'contract_start', label: '계약 시작일', required: true, type: 'date',
        chips: [{ label: '오늘', action: { type: 'today' } }, { label: '다음 달 1일', action: { type: 'nextMonth' } }] },
      { key: 'contract_end', label: '계약 종료일', required: true, type: 'date',
        hint: '그날 밤 23:59:59(한국)까지 유효하게 자동 변환됩니다',
        chips: [{ label: '시작일 + 1년', action: { type: 'oneYear' } }] },
      { key: 'credit_start_month', label: '크레딧 시작 월', required: true, placeholder: '2026-08',
        hint: 'YYYY-MM · 월은 반드시 두 자리',
        chips: [{ label: '계약 시작일에 맞추기', action: { type: 'syncMonth' } }] },
    ],
  },
  {
    title: '3. 크레딧',
    fields: [
      { key: 'base_package_krw', label: '기본 패키지 연 총액', required: true, type: 'number',
        hint: '숫자만 · 쉼표와 "원"을 넣지 마십시오. 월 금액이 아니라 연 총액입니다',
        chips: [
          { label: '100만', action: { type: 'set', value: '1000000' } },
          { label: '300만', action: { type: 'set', value: '3000000' } },
          { label: '500만', action: { type: 'set', value: '5000000' } },
          { label: '1,000만', action: { type: 'set', value: '10000000' } },
        ] },
      { key: 'extra_package_krw', label: '추가 패키지 총액', required: true, type: 'number', hint: '없으면 0' },
      { key: 'extra_months_left', label: '추가분 남은 개월', required: true, type: 'number',
        hint: '없으면 0 · 기준 달은 등록 시점으로 자동 기록됩니다' },
      { key: 'fx_krw_per_usd', label: '환율 (원/달러)', required: true, type: 'number',
        hint: '비우거나 0을 넣으면 등록이 거부됩니다' },
      { key: 'ai_workspace_id', label: 'AI 워크스페이스 ID', placeholder: 'wrkspc_xxx' },
      { key: 'workspace_limit_usd', label: '워크스페이스에 건 한도 (달러)', type: 'number', placeholder: '200' },
    ],
  },
]

/** 원본 기본값 — 원본 input의 value 속성 그대로 */
export const DEFAULT_INPUT: OrgLicenseInput = {
  license_key: '', org_name: '', biz_reg_no: '', contact_name: '', contact_phone: '',
  contact_email: '', contract_doc_no: '', pc_count: '30', contract_start: '', contract_end: '',
  base_package_krw: '3000000', extra_package_krw: '0', extra_months_left: '0',
  credit_start_month: '', ai_workspace_id: '', workspace_limit_usd: '', fx_krw_per_usd: '1500',
  issuer_note: '',
}

/** "잘못 넣기 쉬운 자리" — 원본 7절 표 그대로(8행) */
export const MISTAKES: { mistake: string; result: string }[] = [
  { mistake: '지니스톡 프로젝트에서 실행함', result: '두 프로젝트에 같은 이름의 표가 있어 헷갈립니다. 지금은 지니스톡에 기관 표가 없어 오류가 나며 아무것도 안 써집니다. 붙여넣기 전 프로젝트 이름을 꼭 확인하십시오' },
  { mistake: '기본 패키지에 월 금액을 적음', result: '이번 달 한도가 12배로 잡혀 기관이 예산보다 많이 씁니다' },
  { mistake: '금액에 쉼표나 "원"을 같이 적음', result: 'SQL 오류로 등록이 실패합니다' },
  { mistake: '월을 2026-8로 적음', result: '달 비교가 어긋나 추가분 계산이 틀립니다' },
  { mistake: 'PC 수를 0이나 공란으로 둠', result: '1인당 몫 계산의 분모가 0이 됩니다' },
  { mistake: '같은 키를 두 번 등록', result: '두 번째는 거부됩니다. 등록 전에 키를 조회하십시오' },
  { mistake: '담당자 메일을 안 넣음', result: '한도 알림을 보낼 곳이 없습니다' },
  { mistake: '사업자등록번호 하이픈 유무', result: '세금계산서 대조 때 헷갈립니다. 계약서 그대로 넣으십시오' },
]
