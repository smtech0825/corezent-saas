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
  '쓸 수 있는 조건 필드: house_count(보유 주택 수 — 3은 3주택 이상), tax_base(과세표준·원), is_one_house(1세대 1주택 true/false), total_official_price(공시가격 합계·원), age(만 나이), holding_years(보유 만 연수), residence_years(거주 만 연수), is_residing(현재 거주 여부 true/false), residing_official_price(현재 거주 중인 주택의 공시가격·원 — 거주하지 않으면 0 입력), has_regulated_house(조정대상지역 내 주택 보유 true/false — 주소가 없어 자동 판정이 불가능하므로 사용자 자기신고)',
  '⚠️ 기본공제·공정시장가액비율의 행 조건에는 tax_base(과세표준)를 쓸 수 없습니다 — 과세표준 계산 전에 적용되는 룰이라 그 시점에는 과세표준이 없습니다.',
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
      '두 형식을 지원합니다. 확정법(구 형식): generalAmount(일반)·oneHouseAmount(1세대 1주택) 고정 금액 두 개 — 기존 확정법 룰은 재등록 없이 그대로 동작합니다. 개정안(신 형식): rows 행 조건별 금액 — 한 룰 행에는 한 형식만 쓸 수 있고 혼합은 저장이 거부됩니다.',
      '신 형식의 금액(deduction)은 두 가지입니다. 고정: { "type": "fixed", "amount": 금액 }. 산식: { "type": "base_plus_share", ... } — 금액 = baseAmount(기준액) + bonusAmount(가산액) × (numeratorField 값 ÷ denominatorField 값). 비중은 0~1로 잘라 적용합니다.',
      '산식의 분자·분모는 필드명으로 지정합니다 — 예: 분자 residing_official_price(현재 거주 중인 주택의 공시가격, 거주하지 않으면 0 입력), 분모 total_official_price(공시가격 합계).',
      '⚠️ 신 형식에는 모든 입력이 어느 한 행에는 맞도록 조건 없는 기본 행(priority 최소)을 반드시 두세요 — 산식 행을 기본 행으로 두면 1세대 1주택 행(높은 priority)이 아닌 모든 경우(주택 수 1이지만 1세대 1주택이 아닌 경우 포함)가 산식으로 계산됩니다. 조건을 좁게 걸면(예: house_count min 2) 빠진 조합이 계산 불가로 떨어집니다.',
      '신 형식 각 행의 label(선택)은 화면에 그대로 표시되는 한국어 라벨입니다 — 어느 기준의 공제인지 사용자에게 보여줍니다.',
      '금액·기준액·가산액 0 이하는 저장이 거부됩니다.',
      '이 계산기에서 사람들이 가장 궁금해하는 "나도 내는 건가"가 이 값으로 갈립니다 — 개정 시 반드시 시행일을 나눠 등록하세요. 국회 통과 전 개정안은 status를 proposed로 등록하면 확정법 계산은 흔들리지 않습니다.',
      ...COMPREHENSIVE_COMMON_NOTES,
    ],
    skeleton: `{ "generalAmount": «금액(원)», "oneHouseAmount": «금액(원)» }`,
    altSkeleton: {
      title: '개정안(신 형식) 입력 형식 — 행 조건 + 금액(고정 또는 산식):',
      skeleton: `{
  "rows": [
    {
      "when": { "is_one_house": { "eq": true }, "is_residing": { "eq": true } },
      "priority": 2,
      "label": "«화면 표시용 라벨»",
      "deduction": { "type": "fixed", "amount": «금액(원)» }
    },
    {
      "when": { "is_one_house": { "eq": true }, "is_residing": { "eq": false } },
      "priority": 1,
      "label": "«화면 표시용 라벨»",
      "deduction": { "type": "fixed", "amount": «금액(원)» }
    },
    {
      "when": {},
      "priority": 0,
      "label": "«화면 표시용 라벨»",
      "deduction": {
        "type": "base_plus_share",
        "baseAmount": «기준액(원)»,
        "bonusAmount": «가산액(원)»,
        "numeratorField": "residing_official_price",
        "denominatorField": "total_official_price"
      }
    }
  ]
}`,
    },
  },
  [COMPREHENSIVE_RULE_KEYS.assessmentRatio]: {
    title: '공정시장가액비율 — 과세표준 = (공시가격 합계 − 기본공제) × 이 비율.',
    notes: [
      '두 형식을 지원합니다. 확정법(구 형식): ratioPercent 단일 값 — 기존 확정법 룰은 재등록 없이 그대로 동작합니다. 개정안(신 형식): rows 행 조건별 비율(예: 3주택 이상·조정대상지역 주택 보유자에게 다른 비율) — 혼합은 저장이 거부됩니다.',
      '신 형식에는 모든 입력이 어느 한 행에는 맞도록 조건 없는 기본 행(priority 최소)을 반드시 두세요 — 맞는 행이 없으면 계산이 중단됩니다.',
      'has_regulated_house(조정대상지역 내 주택 보유)는 주소가 없어 자동 판정이 불가능한 자기신고 입력입니다 — 이 조건을 쓰면 사용자가 선택하지 않은 경우 해당 행을 판정하지 못했다는 안내가 결과에 표시됩니다.',
      'ratioPercent 0 이하·100 초과는 저장이 거부됩니다.',
      '재산세의 비율(property.assessment_ratio)과는 별개 룰입니다 — 값이 같아도 따로 등록하세요.',
      ...COMPREHENSIVE_COMMON_NOTES,
    ],
    skeleton: `{ "ratioPercent": «비율%» }`,
    altSkeleton: {
      title: '개정안(신 형식) 입력 형식 — 행 조건별 비율:',
      skeleton: `{
  "rows": [
    { "when": {}, "priority": 0, "ratioPercent": «비율%» },
    { "when": { "house_count": { "min": 3 } }, "priority": 1, "ratioPercent": «비율%» },
    { "when": { "has_regulated_house": { "eq": true } }, "priority": 2, "ratioPercent": «비율%» }
  ]
}`,
    },
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
    title: '1세대 1주택 세액공제 — 확정법은 연령·보유 합산(% 한도), 개정안은 연령(합산) + 보유·거주 중 높은 쪽(% 한도 + 금액 한도).',
    notes: [
      '두 형식을 지원합니다. 확정법(구 형식): ageRows + holdingRows + maxTotalPercent — 연령분·보유분을 합산하되 % 한도를 넘지 못합니다. 기존 확정법 룰은 재등록 없이 그대로 동작합니다.',
      '개정안(신 형식): ageRows + holdingRows(선택) + residenceRows + maxTotalPercent + maxAmount — 연령분은 그대로 합산(좌동)하고, 보유분·거주분 둘 중에서만 높은 쪽 하나를 골라 더합니다. 합산이 maxTotalPercent(% 한도 — 좌동)를 넘으면 한도까지만, 그다음 공제액이 maxAmount(원 — 신설)를 넘으면 한도액까지만 적용됩니다.',
      '신 형식은 residenceRows·maxAmount의 존재로 판별합니다(둘 다 필수). ⚠️ 보유 기준 공제가 폐지되는 시행기간은 holdingRows를 아예 빼고 등록하세요 — 빈 배열·0% 행은 저장이 거부됩니다(양도세 장특공제와 같은 표현).',
      '각 표는 min + priority 오름차순으로 구간을 표현하세요. 요건에 못 미치는 나이·연수는 행을 두지 않으면 자동으로 그 축의 공제가 0이 됩니다 — 0% 행은 저장이 거부됩니다.',
      '신 형식 룰이 유효한 시점에는 계산기에 거주기간(만 연수) 입력이 필요해집니다 — 미입력이면 공제 0으로 계산하지 않고 입력을 요구합니다.',
      '공제액은 재산세 상당액을 뺀 뒤의 종부세액에 곱합니다.',
      ...COMPREHENSIVE_COMMON_NOTES,
    ],
    altSkeleton: {
      title: '개정안(신 형식) 입력 형식 — 연령 합산 + 보유·거주 중 높은 쪽 + % 한도 + 금액 한도:',
      skeleton: `{
  "ageRows": [
    { "when": { "age": { "min": «나이(만)» } }, "priority": 0, "creditPercent": «공제율%» },
    { "when": { "age": { "min": «더 높은 나이(만)» } }, "priority": 1, "creditPercent": «공제율%» }
  ],
  "holdingRows": [
    { "when": { "holding_years": { "min": «연수» } }, "priority": 0, "creditPercent": «공제율%» },
    { "when": { "holding_years": { "min": «더 긴 연수» } }, "priority": 1, "creditPercent": «공제율%» }
  ],
  "residenceRows": [
    { "when": { "residence_years": { "min": «연수» } }, "priority": 0, "creditPercent": «공제율%» },
    { "when": { "residence_years": { "min": «더 긴 연수» } }, "priority": 1, "creditPercent": «공제율%» }
  ],
  "maxTotalPercent": «합산 한도%»,
  "maxAmount": «공제액 한도(원)»
}`,
    },
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
