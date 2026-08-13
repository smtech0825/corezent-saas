/**
 * @파일: lib/tax/types.ts
 * @설명: 세금 계산기 DB 타입 정의 — supabase/migrations/055_tax_engine_schema.sql의
 *        5개 테이블 행 구조를 수동으로 미러링한다.
 *        (이 프로젝트는 DB 타입 자동 생성을 쓰지 않고 모듈별 수동 정의가 관례)
 *        ⚠️ 세율·공제·구간 숫자를 이 파일에 상수로 넣지 않는다. 값은 전부 DB(tax_rules)에서 읽는다.
 */

/** jsonb 컬럼 값의 범용 JSON 타입 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

/**
 * 세목 — tax_rules·tax_calculation_logs의 tax_type CHECK(058 확장분 포함)와 동일.
 * ⚠️ 규제지역(tax_regulated_areas.applies_to)의 CHECK는 앞 6종만 허용한다 —
 *    그쪽 화면·검증은 이 유니언이 아니라 labels.ts의 TAX_TYPES 배열(6종 고정)을 쓴다.
 */
export type TaxType =
  | 'acquisition'       // 취득세
  | 'rental'            // 임대소득세
  | 'transfer'          // 양도소득세
  | 'property'          // 재산세
  | 'comprehensive'     // 종합부동산세
  | 'inheritance'       // 상속·증여세
  | 'stamp'             // 인지세 (058)
  | 'brokerage'         // 중개수수료 (058)
  | 'jeonse_conversion' // 전월세 전환 (058)
  | 'registration'      // 등기비용 (058)

/**
 * 룰 저장소(tax_rules) 전용 세목 — 세목 6종 + 'common'(전 세목 공통 룰, 057에서 CHECK 확장).
 * 수도권 범위(region.metro_scope)처럼 여러 세목이 공유하는 룰은 'common'으로 저장한다.
 * 규제지역·테스트케이스·계산 이력 테이블은 실제 세목만 담으므로 TaxType을 그대로 쓴다.
 */
export type TaxRuleTaxType = TaxType | 'common'

/** 룰 상태 — confirmed(확정법) / proposed(개정안) / repealed(폐지) */
export type TaxRuleStatus = 'confirmed' | 'proposed' | 'repealed'

/** 계산 시 룰 선택 모드 — confirmed(확정법만) / proposed(개정안 포함) */
export type TaxRuleMode = 'confirmed' | 'proposed'

/** 규제지역 구분 — adjustment(조정대상지역) / speculation(투기과열지구) */
export type RegulatedAreaType = 'adjustment' | 'speculation'

/** 규제지역 이력의 적용 세목 — 'all'이면 전 세목 적용 */
export type RegulatedAreaAppliesTo = TaxType | 'all'

/**
 * @타입: TaxRule
 * @설명: tax_rules 행 — 세율표·구간·공제액 등 실제 값(rule_value)과 법령 근거를 담는 룰 저장소.
 *        같은 rule_key가 시행 기간·status를 달리해 여러 행 존재할 수 있다(이력 구조).
 */
export interface TaxRule {
  id: string
  tax_type: TaxRuleTaxType
  rule_key: string
  rule_value: Json
  effective_from: string        // date (YYYY-MM-DD)
  effective_to: string | null   // NULL이면 현재 유효
  status: TaxRuleStatus
  law_name: string              // 근거 법령명
  law_article: string           // 근거 조문
  law_url: string               // 법제처 원문 링크
  law_id: string | null         // 법제처 법령 ID (057) — 법령 개정 자동 감시용, 선택 입력
  law_article_no: string | null // 법제처 조문번호 6자리 = 조번호 4자리 + 가지번호 2자리 (057)
  note: string | null
  created_at: string
  updated_at: string
}

/**
 * @타입: TaxRegulatedArea
 * @설명: tax_regulated_areas 행 — 규제지역 지정/해제 이력.
 *        같은 지역이라도 세목마다 적용 시작일이 다를 수 있어 applies_to로 세목을 한정한다.
 */
export interface TaxRegulatedArea {
  id: string
  sido: string
  sigungu: string
  region_code: string
  area_type: RegulatedAreaType
  applies_to: RegulatedAreaAppliesTo[]
  designated_from: string       // date (YYYY-MM-DD)
  designated_to: string | null  // NULL이면 현재 지정 상태
  source_url: string            // 국토교통부 공고 링크
  note: string | null           // 메모 (059) — 적용 한계·일부 동·읍·면 한정 지정 등 기록
  created_at: string
  updated_at: string
}

/**
 * @타입: TaxTestCase
 * @설명: tax_test_cases 행 — 회귀 테스트 케이스. 이번 Stage는 저장 구조만 있고 실행기는 없다.
 */
export interface TaxTestCase {
  id: string
  tax_type: TaxType
  input: Json
  expected_total: number
  expected_breakdown: Json | null  // 총액만 아는 출처면 NULL
  source: string                   // 정답 출처 (홈택스·위택스 등)
  verified_at: string | null
  note: string | null
  created_at: string
}

/**
 * @타입: TaxCalculationLog
 * @설명: tax_calculation_logs 행 — 계산 이력. 개인식별정보(IP·이메일·이름)는 저장하지 않는다.
 */
export interface TaxCalculationLog {
  id: string
  tax_type: TaxType
  base_date: string             // date (YYYY-MM-DD)
  rule_mode: TaxRuleMode
  input: Json
  output: Json
  applied_rule_ids: string[]    // 적용된 tax_rules.id 목록 (jsonb 배열)
  created_at: string
}

/**
 * @타입: TaxLawChangeQueueItem
 * @설명: tax_law_change_queue 행 — 법령 개정 감지 큐. 다음 Stage(법제처 OPEN API 연동)용이며
 *        이번 Stage에서는 어떤 코드도 이 테이블에 쓰지 않는다.
 */
export interface TaxLawChangeQueueItem {
  id: string
  law_name: string
  law_id: string | null
  article_no: string | null
  detected_at: string
  effective_date: string | null
  change_type: string | null
  raw_payload: Json | null
  status: 'pending' | 'reviewed' | 'ignored'
  reviewed_at: string | null
}
