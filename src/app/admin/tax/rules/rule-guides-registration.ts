/**
 * @파일: admin/tax/rules/rule-guides-registration.ts
 * @설명: 등기비용 룰 키 2종의 입력 형식 안내 — rule-guides.ts의 RULE_GUIDES에 병합된다
 *        (양도세·재산세·종부세와 같은 이유의 파일 분리).
 *        등기비용 계산기의 취득세·인지세 부분은 각 세목의 기존 룰을 그대로 쓰므로
 *        여기에는 등기 고유 룰만 있다. 법무사 보수는 자율 협의라 룰이 없고(사용자 입력),
 *        국민주택채권 즉시매도 손실률도 매일 바뀌므로 룰에 담지 않는다(사용자 입력).
 *        매도 실수령액 계산기는 새 룰이 없다 — 양도소득세·중개수수료 세목의 룰을 그대로 쓴다.
 *        ⚠️ 스켈레톤의 «...»는 자리표시자다 — 실제 수수료·매입률·구간 금액을 이 파일에
 *        절대 넣지 않는다. «...»를 남겨두면 JSON이 아니어서 저장이 거부된다.
 */

import { REGISTRATION_RULE_KEYS } from '@/lib/tax/registration-rules'
import type { RuleGuide } from './rule-guides'

/** 룰 키 → 안내 매핑 (등기비용) */
export const REGISTRATION_RULE_GUIDES: Record<string, RuleGuide> = {
  [REGISTRATION_RULE_KEYS.fee]: {
    title: '등기신청 수수료 — 신청 방법별 정액. 기본 방법 행을 정확히 하나 지정합니다.',
    notes: [
      'rows: 신청 방법별 수수료. methodLabel(방법 이름 — 화면에 그대로 표시)·amount(원, 정액)를 적습니다. 수수료 0원은 저장이 거부됩니다.',
      '⚠️ "default": true를 단 행이 정확히 하나여야 합니다 — 엔진은 기본 행의 금액으로 계산하고, 나머지 행은 "다른 방법 참고 금액"으로 결과에 함께 표시됩니다. 코드는 어떤 방법도 정하지 않으며 이 표시가 유일한 기준입니다.',
      '방법이 하나뿐이면 그 행에 "default": true를 달아 한 행만 등록하세요.',
      '수수료가 바뀌면 기존 룰의 종료일을 닫고 새 시행일로 룰을 나눠 등록하세요.',
    ],
    skeleton: `{
  "rows": [
    { "methodLabel": "«기본으로 쓸 신청 방법 이름»", "amount": «수수료(원)», "default": true },
    { "methodLabel": "«다른 신청 방법 이름»", "amount": «수수료(원)» }
  ]
}`,
  },
  [REGISTRATION_RULE_KEYS.bond]: {
    title: '국민주택채권 매입률(시가표준액·지역 구간별) — 매입 의무액만 계산합니다. 즉시매도 손실률은 룰에 담지 않습니다.',
    notes: [
      '⚠️ 즉시매도 손실률은 금리에 따라 매일 바뀌므로 이 룰에 담지 않습니다 — 계산기 사용자가 주택도시기금 포털에서 당일 값을 확인해 직접 입력합니다. 룰에는 매입률(%)만 담습니다.',
      '쓸 수 있는 조건 필드: official_price(시가표준액·원), price(취득가액·원), sido(시·도 이름 — 계산기 드롭다운 표기와 동일), is_metro(수도권 여부 — 공통 세목 region.metro_scope 룰 필요)',
      '조건(when)은 eq(일치)·min/max(범위, 경계 포함)·in(목록) 연산자를 씁니다. ⚠️ 시가표준액 구간은 max로 나누지 말고 min("○○원 이상") + priority 오름차순으로 표현하세요 — 경계 금액에서 두 행이 동시에 맞아 오류로 중단되는 것을 막는 요령입니다(다른 세목과 동일). 지역 구분(특별시·광역시 등)은 sido의 in 목록 조건으로, 같은 구간의 지역별 행은 priority 대역을 나눠 두세요.',
      '매입 면제 구간(소액 등)은 "exempt": true 행으로 등록하세요 — 그 행에는 ratePercent를 넣지 않습니다(함께 있으면 저장 거부). 화면에는 0원이 아니라 \'면제 — 매입 대상 아님\'으로 표시됩니다. 매입률 0% 저장은 거부됩니다(0%와 면제는 다릅니다). 표는 면제 행을 포함해 모든 시가표준액을 덮어야 합니다 — 조건에 맞는 행이 없으면 계산이 오류로 중단됩니다.',
      '⚠️ rounding(매입액 절사)은 법정 규칙이 있으니 반드시 지정하세요 — unit(절사 단위·원, 정수)과 method("floor" 버림·"round" 반올림·"ceil" 올림). 지정하지 않으면 1원 단위 버림으로 계산되어 실제 매입액과 어긋날 수 있습니다.',
    ],
    skeleton: `{
  "rows": [
    { "when": { "official_price": { "min": «구간 시작 시가표준액(원)» }, "sido": { "in": [«"시·도 이름", ...»] } }, "priority": 10, "ratePercent": «매입률%» },
    { "when": { "official_price": { "min": «구간 시작 시가표준액(원)» } }, "priority": 1, "ratePercent": «매입률%» },
    { "when": {}, "priority": 0, "exempt": true }
  ],
  "rounding": { "unit": «절사 단위(원)», "method": "floor" }
}`,
  },
}
