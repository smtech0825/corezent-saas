/**
 * @파일: admin/org-license/_lib/orgLicenseRpc.ts
 * @설명: 바로 발급(008 issue_org_license) 호출 인자 변환 — orgLicenseSql.ts에서
 *        300줄 규칙 때문에 분리했다(동작 불변). 값 해석은 등록 SQL의 입력값 구획과
 *        완전히 같은 규칙(orgLicenseSql의 v/n)을 그대로 import해서 쓴다 —
 *        여기서 다르게 해석하면 "SQL 복사"와 "바로 발급"의 값이 어긋난다(사본 금지).
 */

import { type OrgLicenseInput, v, n } from './orgLicenseSql'

/**
 * @함수명: toRpcArgs
 * @설명: 발급 함수(issue_org_license, 008)에 넘길 인자를 만듭니다.
 *        workspace_limit_usd는 비우면 null(원본 SQL의 '' → NULL과 동일).
 * @반환값: rpc 호출용 인자 객체(p_* 18개)
 */
export function toRpcArgs(input: OrgLicenseInput): Record<string, string | number | null> {
  return {
    p_license_key:         v(input, 'license_key'),
    p_org_name:            v(input, 'org_name'),
    p_biz_reg_no:          v(input, 'biz_reg_no'),
    p_contact_name:        v(input, 'contact_name'),
    p_contact_phone:       v(input, 'contact_phone'),
    p_contact_email:       v(input, 'contact_email'),
    p_contract_doc_no:     v(input, 'contract_doc_no'),
    p_pc_count:            n(input, 'pc_count'),
    p_contract_start:      v(input, 'contract_start'),
    p_contract_end:        v(input, 'contract_end'),
    p_base_package_krw:    n(input, 'base_package_krw'),
    p_extra_package_krw:   n(input, 'extra_package_krw'),
    p_extra_months_left:   n(input, 'extra_months_left'),
    p_credit_start_month:  v(input, 'credit_start_month'),
    p_ai_workspace_id:     v(input, 'ai_workspace_id'),
    p_workspace_limit_usd: v(input, 'workspace_limit_usd') === '' ? null : n(input, 'workspace_limit_usd'),
    p_fx_krw_per_usd:      n(input, 'fx_krw_per_usd'),
    p_issuer_note:         v(input, 'issuer_note'),
  }
}
