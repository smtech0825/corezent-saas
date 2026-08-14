/**
 * @파일: admin/tax/rules/rule-guides-comprehensive.ts
 * @설명: 종합부동산세 룰 키 8종의 입력 형식 안내 — rule-guides.ts의 RULE_GUIDES에 병합된다
 *        (양도세·재산세와 같은 이유의 파일 분리).
 *        ⚠️ 스켈레톤의 «...»는 자리표시자다 — 실제 세율·비율·공제액·한도·월·일을 이 파일에
 *        절대 넣지 않는다. «...»를 남겨두면 JSON이 아니어서 저장이 거부된다.
 */

import { COMPREHENSIVE_RULE_KEYS } from '@/lib/tax/comprehensive-rules'
import type { RuleGuide } from './rule-guides'

/** 종부세 표(rows) 공통 안내 */
const COMPREHENSIVE_COMMON_NOTES = [
  '쓸 수 있는 조건 필드: house_count(보유 주택 수 — 3은 3주택 이상), tax_base(과세표준·원), is_one_house(1세대 1주택 true/false), total_official_price(공시가격 합계·원), age(만 나이), holding_years(보유 만 연수)',
  '조건(when)은 eq(일치)·min/max(범위, 경계 포함)·in(목록) 연산자를 씁니다. ⚠️ 금액·연수 구간은 max로 나누지 말고 min("○○ 이상") + priority 오름차순으로 표현하세요 — 경계에서 두 행이 동시에 맞아 오류로 중단되는 것을 막는 요령입니다(다른 세목과 동일). 조건 없는 행이 가장 낮은 구간(priority 최소)입니다.',
  '여러 행이 동시에 맞으면 priority가 가장 큰 행이 적용됩니다(같으면 오류).',
]

/** 누진세율(progressive) 표기법 안내 — 양도세·재산세와 같은 표기 */
const PROGRESSIVE_NOTES = [
  '누진세율 표기법: "rate": { "type": "progressive", "brackets": [...] }. 각 구간은 minBase(구간 시작 과세표준·원, 이상)·ratePercent(세율%)·progressiveDeduction(누진공제액·원). 세액 = 과세표준 × 세율% − 누진공제액입니다.',
  '구간도 max 없이 minBase 오름차순으로만 씁니다. 최저 구간은 minBase를 생략(=0)하고 누진공제액 0으로 두세요.',
]

/** 룰 키 → 안내 매핑 (종합부동산세) */
export const COMPREHENSIVE_RULE_GUIDES: Record<string, RuleGuide> = {
  [COMPREHENSIVE_RULE_KEYS.basicDeduction]: {
    title: '기본공제 — 공시가격 합계에서 빼는 금액. 합계가 이 금액 이하면 "과세 대상 아님"으로 판정됩니다.',
    notes: [
      'generalAmount: 일반 기본공제(원). oneHouseAmount: 1세대 1주택 기본공제(원). 둘 다 0 이하는 저장이 거부됩니다.',
      '이 계산기에서 사람들이 가장 궁금해하는 "나도 내는 건가"가 이 값으로 갈립니다 — 개정 시 반드시 시행일을 나눠 등록하세요.',
    ],
    skeleton: `{ "generalAmount": «금액(원)», "oneHouseAmount": «금액(원)» }`,
  },
  [COMPREHENSIVE_RULE_KEYS.assessmentRatio]: {
    title: '공정시장가액비율 — 과세표준 = (공시가격 합계 − 기본공제) × 이 비율.',
    notes: [
      'ratioPercent: 공정시장가액비율(%). 0 이하·100 초과는 저장이 거부됩니다.',
      '재산세의 비율(property.assessment_ratio)과는 별개 룰입니다 — 값이 같아도 따로 등록하세요.',
    ],
    skeleton: `{ "ratioPercent": «비율%» }`,
  },
  [COMPREHENSIVE_RULE_KEYS.rates]: {
    title: '종합부동산세 세율표 — 일반/중과를 행 조건(주택 수·과세표준)으로 나누고, 중과 행에는 heavy 표시를 답니다.',
    notes: [
      '일반과 중과를 별도 표가 아니라 한 표의 행으로 등록합니다: 조건 없는 행(일반, priority 낮게) + 중과 조건 행(예: house_count min 3에 tax_base 조건, priority 높게).',
      '"heavy": true를 단 행이 선택되면 결과에 "중과 세율표 적용"으로 표시됩니다 — 중과 행에는 반드시 달아 주세요(빠뜨리면 화면이 일반으로 표시됩니다).',
      '3주택 이상이라도 과세표준이 낮으면 일반 세율인 규정은, 중과 행의 tax_base 조건(min)으로 표현하세요.',
      '⚠️ 이 계산기는 재산세 상당액 공제를 재산세(property) 룰로 자동 계산합니다 — 재산세 룰 세트(공정시장가액비율·세율표·과세기준일)가 등록돼 있지 않으면 종부세 계산 전체가 제공되지 않습니다.',
      ...PROGRESSIVE_NOTES,
      ...COMPREHENSIVE_COMMON_NOTES,
    ],
    skeleton: `{
  "rows": [
    {
      "when": {},
      "priority": 0,
      "rate": {
        "type": "progressive",
        "brackets": [
          { "ratePercent": «세율%», "progressiveDeduction": 0 },
          { "minBase": «구간 시작 과세표준(원)», "ratePercent": «세율%», "progressiveDeduction": «누진공제액(원)» }
        ]
      }
    },
    {
      "when": { "house_count": { "min": 3 }, "tax_base": { "min": «중과 시작 과세표준(원)» } },
      "priority": 1,
      "heavy": true,
      "rate": {
        "type": "progressive",
        "brackets": [
          { "ratePercent": «세율%», "progressiveDeduction": 0 },
          { "minBase": «구간 시작 과세표준(원)», "ratePercent": «세율%», "progressiveDeduction": «누진공제액(원)» }
        ]
      }
    }
  ]
}`,
  },
  [COMPREHENSIVE_RULE_KEYS.taxCredit]: {
    title: '1세대 1주택 세액공제 — 연령별·보유기간별 공제율과 합산 한도.',
    notes: [
      'ageRows: 만 나이 조건별 공제율. holdingRows: 보유 만 연수 조건별 공제율. 각각 min + priority 오름차순으로 구간을 표현하세요.',
      '요건에 못 미치는 나이·연수는 행을 두지 않으면 자동으로 그 축의 공제가 0이 됩니다 — 0% 행은 저장이 거부됩니다.',
      'maxTotalPercent: 두 공제율 합의 상한(%). 합이 이를 넘으면 한도까지만 적용되고 결과에 "합산 한도 도달"로 표시됩니다.',
      '공제액은 재산세 상당액을 뺀 뒤의 종부세액에 곱합니다.',
      ...COMPREHENSIVE_COMMON_NOTES,
    ],
    skeleton: `{
  "ageRows": [
    { "when": { "age": { "min": «나이(만)» } }, "priority": 0, "creditPercent": «공제율%» },
    { "when": { "age": { "min": «더 높은 나이(만)» } }, "priority": 1, "creditPercent": «공제율%» }
  ],
  "holdingRows": [
    { "when": { "holding_years": { "min": «연수» } }, "priority": 0, "creditPercent": «공제율%» },
    { "when": { "holding_years": { "min": «더 긴 연수» } }, "priority": 1, "creditPercent": «공제율%» }
  ],
  "maxTotalPercent": «합산 한도%»
}`,
  },
  [COMPREHENSIVE_RULE_KEYS.burdenCap]: {
    title: '세부담 상한 — 직전 연도 총세액(재산세+종부세 상당액) 대비 상한. 초과분은 종부세에서 덜어냅니다.',
    notes: [
      '상한액 = 직전 연도 총세액 × capPercent ÷ 100. 비교 대상은 당해 재산세 상당액 + 종부세액이며, 상한을 넘으면 종부세에서만 깎습니다(재산세는 건드리지 않습니다).',
      '⚠️ 이 상한은 계산기 사용자가 직전 연도 총세액을 입력한 경우에만 적용됩니다. 비우면 상한 없이 계산되고 그 사실이 결과에 표시됩니다 — 추정하지 않습니다.',
      'capPercent 0 이하는 저장이 거부됩니다. 주택 수별로 상한이 다르면 house_count 조건으로 행을 나누세요.',
      ...COMPREHENSIVE_COMMON_NOTES,
    ],
    skeleton: `{
  "rows": [
    { "when": {}, "priority": 0, "capPercent": «상한%» }
  ]
}`,
  },
  [COMPREHENSIVE_RULE_KEYS.ruralSurtax]: {
    title: '농어촌특별세 — 종합부동산세액(상한 적용 후)에 비례해 붙습니다.',
    notes: [
      'ratePercent: 농어촌특별세율(%). 0 이하는 저장이 거부됩니다.',
      '이 룰이 없으면 종부세 계산 전체가 제공되지 않습니다(농특세를 조용히 0으로 계산하지 않기 위해서입니다).',
    ],
    skeleton: `{ "ratePercent": «세율%» }`,
  },
  [COMPREHENSIVE_RULE_KEYS.assessmentDate]: {
    title: '과세기준일(월·일) — 계산 기준일의 유일한 출처입니다. 재산세와 값이 같아도 따로 등록하세요.',
    notes: [
      'month(1~12)·day(1~31): 과세기준일의 월·일. 엔진이 과세연도와 조합해 기준일을 만듭니다 — 코드에는 어떤 날짜도 없습니다.',
      '⚠️ 시행일(effective_from)을 충분히 과거로 두세요. 엔진은 과세연도의 1월 1일 시점에 유효한 이 룰로 과세기준일을 찾으므로, 시행일이 그보다 늦으면 그 연도 계산이 "룰 미등록"이 됩니다.',
      '한 해 안에서 값이 바뀌면(연중 변경) 기준일을 정할 수 없어 계산이 중단됩니다 — 시행기간을 연 단위 경계로 정리하세요.',
    ],
    skeleton: `{ "month": «월», "day": «일» }`,
  },
  [COMPREHENSIVE_RULE_KEYS.rounding]: {
    title: '단수 처리(선택) — 세액의 절사 단위·방식. 등록하지 않으면 1원 단위 버림입니다.',
    notes: ['unit: 절사 단위(원, 정수) / method: "floor"(버림)·"round"(반올림)·"ceil"(올림)'],
    skeleton: `{ "unit": «단위(원)», "method": "floor" }`,
  },
}
