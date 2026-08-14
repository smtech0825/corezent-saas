/**
 * @파일: admin/tax/rules/rule-guides-property.ts
 * @설명: 재산세 룰 키 8종의 입력 형식 안내 — rule-guides.ts의 RULE_GUIDES에 병합된다
 *        (양도세와 같은 이유의 파일 분리).
 *        ⚠️ 스켈레톤의 «...»는 자리표시자다 — 실제 세율·비율·금액·월·일을 이 파일에
 *        절대 넣지 않는다. «...»를 남겨두면 JSON이 아니어서 저장이 거부된다.
 */

import { PROPERTY_RULE_KEYS } from '@/lib/tax/property-rules'
import type { RuleGuide } from './rule-guides'

/** 재산세 표(rows) 공통 안내 */
const PROPERTY_COMMON_NOTES = [
  '쓸 수 있는 조건 필드: official_price(공시가격·원), is_one_house(1세대 1주택 true/false)',
  '조건(when)은 eq(일치)·min/max(범위, 경계 포함)·in(목록) 연산자를 씁니다. ⚠️ 공시가격 구간은 max로 나누지 말고 min("○○원 이상") + priority 오름차순으로 표현하세요 — 경계 금액에서 두 행이 동시에 맞아 오류로 중단되는 것을 막는 요령입니다(다른 세목과 동일). 조건 없는 행이 가장 낮은 구간(priority 최소)입니다.',
  '여러 행이 동시에 맞으면 priority가 가장 큰 행이 적용됩니다(같으면 오류).',
]

/** 누진세율(progressive) 표기법 안내 — 양도세와 같은 표기 */
const PROGRESSIVE_NOTES = [
  '누진세율 표기법: { "type": "progressive", "brackets": [...] }. 각 구간은 minBase(구간 시작 과세표준·원, 이상)·ratePercent(세율%)·progressiveDeduction(누진공제액·원). 과세표준이 minBase 이상인 구간 중 시작값이 가장 큰 행이 적용되고, 세액 = 과세표준 × 세율% − 누진공제액입니다.',
  '구간도 max 없이 minBase 오름차순으로만 씁니다. 최저 구간은 minBase를 생략(=0)하고 누진공제액 0으로 두세요.',
]

/** 룰 키 → 안내 매핑 (재산세) */
export const PROPERTY_RULE_GUIDES: Record<string, RuleGuide> = {
  [PROPERTY_RULE_KEYS.assessmentRatio]: {
    title: '일반 공정시장가액비율 — 과세표준 = 공시가격 × 이 비율. 1세대 1주택 특례는 별도 키로 등록합니다.',
    notes: [
      'ratioPercent: 공정시장가액비율(%). 0 이하·100 초과는 저장이 거부됩니다.',
      '1세대 1주택 특례 비율은 이 룰이 아니라 property.assessment_ratio.one_house(별도 키)에 등록하세요 — 특례가 종료돼도 이 일반 비율은 계속 유효해야 하기 때문입니다.',
      '비율이 바뀌면 기존 룰의 종료일을 닫고 새 시행일로 룰을 나눠 등록하세요.',
    ],
    skeleton: `{ "ratioPercent": «비율%» }`,
  },
  [PROPERTY_RULE_KEYS.assessmentRatioOneHouse]: {
    title: '1세대 1주택 공정시장가액비율 특례(공시가격 구간별) — ⚠️ 한시 특례: 반드시 종료일을 설정하세요.',
    notes: [
      '⚠️⚠️ 이 특례는 적용 연도가 법 조문에 못박힌 한시 특례입니다. 등록할 때 반드시 종료일(effective_to)을 조문의 마지막 적용일로 설정하세요. 종료일을 빠뜨리면 특례가 영구히 적용되어 세금이 계속 낮게 나옵니다 — 이 화면에서 막을 수 없는 실수이니 등록 시점에 확인해야 합니다.',
      '종료일이 지나면 엔진이 자동으로 일반 비율(property.assessment_ratio)로 전환합니다 — 별도 조치가 필요 없습니다. 특례가 연장되면 새 시행기간으로 룰을 추가 등록하세요.',
      'rows: 공시가격 구간별 비율. ratioPercent는 0 이하·100 초과 저장 거부.',
      '구간표는 모든 공시가격을 덮어야 합니다 — 빠진 구간이 있으면 1세대 1주택 계산이 오류로 중단됩니다(조용히 일반 비율로 넘어가지 않습니다).',
      ...PROPERTY_COMMON_NOTES,
    ],
    skeleton: `{
  "rows": [
    { "when": {}, "priority": 0, "ratioPercent": «비율%» },
    { "when": { "official_price": { "min": «구간 시작 공시가격(원)» } }, "priority": 1, "ratioPercent": «비율%» },
    { "when": { "official_price": { "min": «더 큰 구간 시작(원)» } }, "priority": 2, "ratioPercent": «비율%» }
  ]
}`,
  },
  [PROPERTY_RULE_KEYS.rates]: {
    title: '재산세 세율표 — 일반 누진세율 + 1세대 1주택 특례세율표(선택).',
    notes: [
      'general: 일반 세율(누진). 항상 필요합니다.',
      'oneHouse(선택): 1세대 1주택 특례세율표 — 1세대 1주택이면서 공시가격이 maxOfficialPrice 이하일 때만 적용됩니다. 특례세율도 한시 규정이면, 특례가 끝나는 시점에 oneHouse를 뺀 새 룰을 다음 시행기간으로 등록하세요(기존 룰은 종료일을 닫고).',
      '세율 0% 이하는 저장이 거부됩니다.',
      ...PROGRESSIVE_NOTES,
    ],
    skeleton: `{
  "general": {
    "type": "progressive",
    "brackets": [
      { "ratePercent": «세율%», "progressiveDeduction": 0 },
      { "minBase": «구간 시작 과세표준(원)», "ratePercent": «세율%», "progressiveDeduction": «누진공제액(원)» }
    ]
  },
  "oneHouse": {
    "maxOfficialPrice": «특례 적용 공시가격 상한(원)»,
    "rate": {
      "type": "progressive",
      "brackets": [
        { "ratePercent": «세율%», "progressiveDeduction": 0 },
        { "minBase": «구간 시작 과세표준(원)», "ratePercent": «세율%», "progressiveDeduction": «누진공제액(원)» }
      ]
    }
  }
}`,
  },
  [PROPERTY_RULE_KEYS.surtax]: {
    title: '재산세 부가 세목 — 지방교육세(본세 기준)·도시지역분(과세표준 기준).',
    notes: [
      'localEducation: 지방교육세 — 재산세 본세에 곱합니다. urbanArea: 도시지역분 — 과세표준에 곱하며 도시지역일 때만 붙습니다(계산기 입력이 정함).',
      '두 세율 모두 0% 이하는 저장이 거부됩니다. 이 룰이 없으면 재산세 계산 전체가 제공되지 않습니다(부가 세목을 조용히 0으로 계산하지 않기 위해서입니다).',
      '세부담 상한은 본세에만 적용됩니다 — 이 두 세목에는 반영되지 않습니다(화면에도 같은 한계가 안내됩니다).',
    ],
    skeleton: `{
  "localEducation": { "type": "fixed", "ratePercent": «세율%» },
  "urbanArea": { "type": "fixed", "ratePercent": «세율%» }
}`,
  },
  [PROPERTY_RULE_KEYS.baseCap]: {
    title: '과세표준 상한 — 직전 연도 과세표준에서 일정 비율 이상 오르지 못하게 막습니다.',
    notes: [
      '상한액 = 직전 연도 과세표준 + (기준 과세표준 × increasePercent ÷ 100).',
      "increaseBasis: 비율을 곱하는 기준 — 'current_base'(당해 연도 상한 적용 전 과세표준) 또는 'previous_base'(직전 연도 과세표준). 법령 산식이 어느 쪽인지 조문을 확인해 지정하세요 — 코드는 해석하지 않습니다.",
      '⚠️ 이 상한은 계산기 사용자가 직전 연도 과세표준을 입력한 경우에만 적용됩니다. 비우면 상한 없이 계산되고 그 사실이 결과에 표시됩니다 — 추정하지 않습니다.',
      'increasePercent 음수는 저장이 거부됩니다.',
    ],
    skeleton: `{ "increasePercent": «상한율%», "increaseBasis": "current_base" }`,
  },
  [PROPERTY_RULE_KEYS.burdenCap]: {
    title: '세부담 상한(공시가격 구간별) — 직전 연도 재산세액(본세) 대비 상한. 경과조치 종료는 시행기간으로 표현합니다.',
    notes: [
      '상한액 = 직전 연도 재산세액(본세) × capPercent ÷ 100. 본세에만 적용되며 지방교육세·도시지역분에는 반영되지 않습니다.',
      '⚠️ 이 상한은 계산기 사용자가 직전 연도 재산세액을 입력한 경우에만 적용됩니다. 비우면 상한 없이 계산되고 그 사실이 결과에 표시됩니다 — 추정하지 않습니다.',
      '⚠️ 옛 제도의 경과조치가 끝나는 날을 이 룰의 종료일(effective_to)로 설정하세요. 종료일이 지나면 상한이 자동으로 적용되지 않습니다 — 날짜를 코드에 두지 않는 구조입니다.',
      'capPercent 0 이하는 저장이 거부됩니다(세액 0원 함정 방지).',
      '구간표는 모든 공시가격을 덮어야 합니다 — 직전 연도 값을 입력했는데 빠진 구간에 걸리면 계산이 오류로 중단됩니다.',
      ...PROPERTY_COMMON_NOTES,
    ],
    skeleton: `{
  "rows": [
    { "when": {}, "priority": 0, "capPercent": «상한%» },
    { "when": { "official_price": { "min": «구간 시작 공시가격(원)» } }, "priority": 1, "capPercent": «상한%» },
    { "when": { "official_price": { "min": «더 큰 구간 시작(원)» } }, "priority": 2, "capPercent": «상한%» }
  ]
}`,
  },
  [PROPERTY_RULE_KEYS.assessmentDate]: {
    title: '과세기준일(월·일) — 이 날짜의 소유자에게 부과됩니다. 계산 기준일의 유일한 출처입니다.',
    notes: [
      'month(1~12)·day(1~31): 과세기준일의 월·일. 엔진이 계산기 사용자가 고른 과세연도와 조합해 기준일(YYYY-MM-DD)을 만듭니다 — 코드에는 어떤 날짜도 없습니다.',
      '⚠️ 시행일(effective_from)을 충분히 과거로 두세요. 엔진은 과세연도의 1월 1일 시점에 유효한 이 룰로 과세기준일을 찾으므로, 시행일이 그보다 늦으면 그 연도 계산이 "룰 미등록"이 됩니다.',
      '한 해 안에서 이 룰의 값이 바뀌면(연중 변경) 기준일을 정할 수 없어 계산이 중단됩니다 — 시행기간을 연 단위 경계로 정리하세요.',
    ],
    skeleton: `{ "month": «월», "day": «일» }`,
  },
  [PROPERTY_RULE_KEYS.rounding]: {
    title: '단수 처리(선택) — 세목별 세액의 절사 단위·방식. 등록하지 않으면 1원 단위 버림입니다.',
    notes: ['unit: 절사 단위(원, 정수) / method: "floor"(버림)·"round"(반올림)·"ceil"(올림)'],
    skeleton: `{ "unit": «단위(원)», "method": "floor" }`,
  },
}
