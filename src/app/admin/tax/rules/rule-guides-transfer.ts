/**
 * @파일: admin/tax/rules/rule-guides-transfer.ts
 * @설명: 양도소득세 룰 키 12종의 입력 형식 안내 — rule-guides.ts의 RULE_GUIDES에 병합된다
 *        (rule-guides.ts가 300줄에 가까워 양도세 안내는 파일 분리).
 *        ⚠️ 스켈레톤의 «...»는 자리표시자다 — 실제 세율·공제율·금액·연수·날짜를 이 파일에
 *        절대 넣지 않는다. «...»를 남겨두면 JSON이 아니어서 저장이 거부된다.
 */

import { TRANSFER_RULE_KEYS } from '@/lib/tax/transfer-rules'
import type { RuleGuide } from './rule-guides'

/** 양도세 표(rows) 공통 안내 */
const TRANSFER_COMMON_NOTES = [
  '쓸 수 있는 조건 필드: house_count(주택 수 — 3은 3주택 이상), is_regulated(양도 당시 조정대상지역 true/false), holding_years(세율용 보유 만 연수 — §104②), holding_years_ltsd(공제용 보유 만 연수 — §95④, 세율용과 다름!), residence_years(거주 만 연수), transfer_price(양도가액·원), sido·sigungu(소재지 이름 — 계산기 드롭다운 표기와 동일), is_metro(수도권 — 공통 세목 region.metro_scope 룰 필요)',
  '조건(when)은 eq(일치)·min/max(범위, 경계 포함)·in(목록) 연산자를 씁니다. 금액 구간은 max 대신 min + priority 오름차순으로(경계 충돌 방지 — 취득세·중개수수료와 같은 요령), 연수 구간은 만 연수 정수라 eq 또는 min을 쓰세요.',
  '여러 행이 동시에 맞으면 priority가 가장 큰 행이 적용됩니다(같으면 오류).',
]

/** 누진세율(progressive) 표기법 안내 — 기본세율·지방소득세가 공용 */
const PROGRESSIVE_NOTES = [
  '누진세율 표기법: "rate": { "type": "progressive", "brackets": [...] }. 각 구간은 minBase(구간 시작 과세표준·원, 이상)·ratePercent(세율%)·progressiveDeduction(누진공제액·원). 과세표준이 minBase 이상인 구간 중 시작값이 가장 큰 행이 적용되고, 세액 = 과세표준 × 세율% − 누진공제액입니다.',
  '구간도 max 없이 minBase 오름차순으로만 씁니다 — 경계 금액 충돌이 없습니다. 최저 구간은 minBase를 생략(=0)하고 누진공제액 0으로 두세요. minBase가 같은 구간이 둘이면 저장이 거부됩니다.',
]

/** 룰 키 → 안내 매핑 (양도소득세) */
export const TRANSFER_RULE_GUIDES: Record<string, RuleGuide> = {
  [TRANSFER_RULE_KEYS.baseRates]: {
    title: '기본세율(누진 구조) — 과세표준 구간별 세율과 누진공제액.',
    notes: [...PROGRESSIVE_NOTES],
    skeleton: `{
  "rate": {
    "type": "progressive",
    "brackets": [
      { "ratePercent": «세율%», "progressiveDeduction": 0 },
      { "minBase": «구간 시작 과세표준(원)», "ratePercent": «세율%», "progressiveDeduction": «누진공제액(원)» },
      { "minBase": «더 큰 구간 시작(원)», "ratePercent": «세율%», "progressiveDeduction": «누진공제액(원)» }
    ]
  }
}`,
  },
  [TRANSFER_RULE_KEYS.shortTermRates]: {
    title: '단기 보유 세율표 — 조건에 맞는 행이 있으면 기본세율과 비교해 큰 세액을 적용(비교과세).',
    notes: [
      '보유기간 조건은 세율용 만 연수(holding_years)에 eq를 쓰세요: 1년 미만 = { "eq": 0 }, 1년 이상 2년 미만 = { "eq": 1 }. 단기 대상이 아닌 연수(예: 2년 이상)는 행을 두지 않으면 자동으로 단기 미적용이 됩니다.',
      ...TRANSFER_COMMON_NOTES.slice(0, 1),
    ],
    skeleton: `{
  "rows": [
    { "when": { "holding_years": { "eq": 0 } }, "priority": 1, "rate": { "type": "fixed", "ratePercent": «세율%» } },
    { "when": { "holding_years": { "eq": 1 } }, "priority": 0, "rate": { "type": "fixed", "ratePercent": «세율%» } }
  ]
}`,
  },
  [TRANSFER_RULE_KEYS.heavy]: {
    title: '다주택 중과 — 기본세율에 더할 가산 %p와 경과조치. 중과 유예 기간은 이 룰의 시행기간으로 표현합니다.',
    notes: [
      '⚠️ 중과가 유예되는 기간에는 이 룰이 유효하지 않게 하세요(이전 룰의 종료일을 닫고, 재개일부터 시행하는 룰을 등록). 양도일에 유효한 heavy 룰이 없으면 엔진은 중과를 적용하지 않습니다 — 날짜를 코드에 두지 않는 구조입니다.',
      'rows: 주택 수 조건별 가산 포인트(addPercentPoints, %p). 0은 저장이 거부됩니다.',
      'grace(경과조치): contractDeadline(계약 마감일 YYYY-MM-DD — 이 날짜 이전 계약 체결·계약금 수령 시) + rows(지역 조건별 허용 개월 수 monthsFromContract) + finalDeadline(선택, 최종 양도 기한). 지역 구분은 조건 없는 공통 행 + 특정 시·도/구 행(높은 priority)으로 표현하세요.',
      '계산기 화면의 경과조치 안내 날짜는 이 룰의 contractDeadline을 자동으로 읽습니다 — 룰만 고치면 화면이 따라옵니다.',
      ...TRANSFER_COMMON_NOTES,
    ],
    skeleton: `{
  "rows": [
    { "when": { "house_count": { "eq": 2 } }, "priority": 0, "addPercentPoints": «가산 %p» },
    { "when": { "house_count": { "min": 3 } }, "priority": 1, "addPercentPoints": «가산 %p» }
  ],
  "grace": {
    "contractDeadline": "«YYYY-MM-DD»",
    "rows": [
      { "when": {}, "priority": 0, "monthsFromContract": «개월» },
      {
        "when": { "sido": { "eq": "«시·도 이름»" }, "sigungu": { "in": [«"구 이름", "구 이름", ...»] } },
        "priority": 10,
        "monthsFromContract": «개월»
      }
    ],
    "finalDeadline": "«YYYY-MM-DD»"
  }
}`,
  },
  [TRANSFER_RULE_KEYS.ltsdGeneral]: {
    title: '장기보유특별공제 일반 표(작은 표) — 1세대 1주택 큰 표 대상이 아닐 때 적용.',
    notes: [
      '두 형식을 지원합니다. 확정법(구 형식): rows — 보유 연수(holding_years_ltsd) 조건 단일 표. 기존 확정법 룰은 재등록 없이 그대로 동작합니다.',
      '개정안(신 형식): holdingRows + residenceRows — 보유분과 거주분(residence_years 조건) 중 높은 쪽 하나만 적용합니다. 혼합은 저장이 거부됩니다. 거주기간 미입력 계산은 보유분만 적용하고 그 사실이 결과에 표시됩니다.',
      '⚠️ 보유 기준 공제가 폐지되는 시행기간은 holdingRows를 아예 빼고 등록하세요(거주 기준만 남음). 빈 배열·0% 행은 저장이 거부됩니다 — 폐지는 필드 생략으로만 표현합니다. residenceRows는 신 형식의 필수 필드입니다(보유 기준만 있는 표는 구 형식 rows로).',
      '조건 필드는 holding_years_ltsd(공제용 보유 만 연수 — §95④, 상속은 상속개시일 기산)입니다. 세율용 보유(holding_years)와 절대 혼용하지 마세요.',
      '연수별 행을 min + priority 오름차순으로 두세요 — priority를 연수와 같은 값으로 두면 간단합니다. 최소 연수 미만은 행이 없으면 자동으로 공제 0이 됩니다.',
      'deductPercent 0%는 저장이 거부됩니다(공제 없음은 행을 두지 않는 것으로 표현).',
      '공제액의 물건별 한도는 이 표가 아니라 별도 룰(transfer.ltsd.cap)로 등록합니다 — 큰 표·일반 표에 공통 적용됩니다.',
    ],
    skeleton: `{
  "rows": [
    { "when": { "holding_years_ltsd": { "min": «연수» } }, "priority": «연수와 같은 값», "deductPercent": «공제율%» },
    { "when": { "holding_years_ltsd": { "min": «더 큰 연수» } }, "priority": «연수와 같은 값», "deductPercent": «공제율%» }
  ]
}`,
    altSkeleton: {
      title: '개정안(신 형식) 입력 형식 — 보유분·거주분 중 높은 쪽 하나만 적용:',
      skeleton: `{
  "holdingRows": [
    { "when": { "holding_years_ltsd": { "min": «연수» } }, "priority": «연수와 같은 값», "deductPercent": «공제율%» }
  ],
  "residenceRows": [
    { "when": { "residence_years": { "min": «연수» } }, "priority": «연수와 같은 값», "deductPercent": «공제율%» }
  ]
}`,
    },
  },
  [TRANSFER_RULE_KEYS.ltsdOneHouse]: {
    title: '장기보유특별공제 큰 표 — 1세대 1주택 + 거주 요건 충족 시. 보유분·거주분을 합산합니다.',
    notes: [
      '⚠️ minResidenceYears(이 표를 쓰기 위한 최소 거주 연수)는 지역과 무관하게 항상 적용됩니다 — 비과세의 거주 요건(취득 당시 조정대상지역인 경우만)과 다른 조문·다른 조건입니다. 혼동하지 마세요.',
      'holdingRows는 holding_years_ltsd 조건, residenceRows는 residence_years 조건으로 각각 min + priority 오름차순(연수와 같은 값 권장).',
      '두 표에서 각각 행을 찾아 공제율을 합산합니다. deductPercent 0%는 저장이 거부됩니다.',
      '⚠️ 보유 기준 공제가 폐지되는 시행기간(개편안)은 holdingRows를 아예 빼고 등록하세요 — 거주분만 계산되고 결과에 "보유 기준 공제가 없습니다"로 표시됩니다. 빈 배열·0% 행은 저장이 거부됩니다.',
    ],
    skeleton: `{
  "minResidenceYears": «연수»,
  "holdingRows": [
    { "when": { "holding_years_ltsd": { "min": «연수» } }, "priority": «연수와 같은 값», "deductPercent": «공제율%» }
  ],
  "residenceRows": [
    { "when": { "residence_years": { "min": «연수» } }, "priority": «연수와 같은 값», "deductPercent": «공제율%» }
  ]
}`,
  },
  [TRANSFER_RULE_KEYS.ltsdCap]: {
    title: '장기보유특별공제 물건별 한도(원) — 개정안 룰. 등록하지 않으면 한도 없이 계산합니다.',
    notes: [
      'perPropertyAmount: 물건 하나의 공제액 한도(원). 큰 표·일반 표 어느 쪽으로 계산됐든 공제액이 이를 넘으면 한도액까지만 적용되고 결과에 표시됩니다. 0 이하는 저장이 거부됩니다.',
      '확정법에는 한도 규정이 없으므로 이 룰은 개정안(proposed)으로만 등록하세요 — 기준일에 유효한 룰이 없으면 엔진이 한도를 적용하지 않는 것이 확정법의 올바른 동작입니다.',
      '⚠️ 같은 해에 여러 물건을 양도한 경우의 "인별" 합산 한도는 단일 물건 계산기가 알 수 없어 적용하지 않습니다 — 화면 판단 한계에 그 사실이 안내됩니다.',
    ],
    skeleton: `{ "perPropertyAmount": «물건별 한도(원)» }`,
  },
  [TRANSFER_RULE_KEYS.basicDeduction]: {
    title: '기본공제 — 양도소득금액에서 빼는 금액(원).',
    notes: [
      '두 형식을 지원합니다. 확정법(구 형식): amount 고정 금액 — 기존 확정법 룰은 재등록 없이 그대로 동작합니다.',
      '개정안(신 형식): rows — 행 조건별 금액. 거주기간(residence_years)·양도가액(transfer_price·원) 조건을 쓸 수 있습니다. 혼합은 저장이 거부됩니다.',
      '신 형식에는 모든 입력이 어느 한 행에는 맞도록 조건 없는 기본 행(priority 최소)을 반드시 두세요 — 맞는 행이 없으면 계산이 중단됩니다.',
      '금액 0은 저장이 거부됩니다.',
      ...TRANSFER_COMMON_NOTES.slice(1),
    ],
    skeleton: `{ "amount": «금액(원)» }`,
    altSkeleton: {
      title: '개정안(신 형식) 입력 형식 — 거주기간·양도가액 조건별 금액:',
      skeleton: `{
  "rows": [
    { "when": {}, "priority": 0, "amount": «금액(원)» },
    {
      "when": { "residence_years": { "min": «연수» }, "transfer_price": { "min": «금액(원)» } },
      "priority": 1,
      "amount": «금액(원)»
    }
  ]
}`,
    },
  },
  [TRANSFER_RULE_KEYS.exemption]: {
    title: '1세대 1주택 비과세 요건과 고가주택 기준.',
    notes: [
      'minHoldingYears: 비과세 보유 요건(만 연수).',
      '⚠️ residenceIfAcquiredRegulated.minYears: 거주 요건(만 연수) — "취득 당시" 조정대상지역이었던 경우에만 적용됩니다. 장기보유특별공제 큰 표의 거주 요건(항상 적용)과 다른 조문입니다. 혼동하지 마세요.',
      'highPriceThreshold: 고가주택 기준(양도가액·원). 양도가액이 이를 넘으면 초과분 비율만 과세하며, 양도차익과 장기보유특별공제 양쪽에 같은 비율을 곱합니다.',
    ],
    skeleton: `{
  "minHoldingYears": «연수»,
  "residenceIfAcquiredRegulated": { "minYears": «연수» },
  "highPriceThreshold": «금액(원)»
}`,
  },
  [TRANSFER_RULE_KEYS.temporaryTwoHouse]: {
    title: '일시적 2주택 — 신규주택 취득일부터 종전주택을 양도해야 하는 허용 연수.',
    notes: ['maxYearsFromNewAcquisition: 허용 연수(응당일 당일까지 포함해 판정). 충족하면 1주택으로 보아 비과세·공제를 판정합니다.'],
    skeleton: `{ "maxYearsFromNewAcquisition": «연수» }`,
  },
  [TRANSFER_RULE_KEYS.localIncomeTax]: {
    title: '지방소득세 — 양도소득세의 10%가 아니라 같은 과세표준에 적용하는 별도 세율표(독립 세목).',
    notes: [
      'rate: 기본 누진 세율표(양도소득세와 같은 progressive 표기법 — 값만 지방소득세 조문의 것).',
      '⚠️ shortTerm.rows(단기 대응)·heavyRows(중과 가산 대응)를 국세와 같은 구조로 함께 등록하세요. 국세가 단기·중과 경로로 계산되는데 지방 대응 표가 없으면 계산 전체가 중단됩니다(국세의 10%로 추정하지 않습니다).',
      ...PROGRESSIVE_NOTES.slice(1),
    ],
    skeleton: `{
  "rate": {
    "type": "progressive",
    "brackets": [
      { "ratePercent": «세율%», "progressiveDeduction": 0 },
      { "minBase": «구간 시작 과세표준(원)», "ratePercent": «세율%», "progressiveDeduction": «누진공제액(원)» }
    ]
  },
  "shortTerm": {
    "rows": [
      { "when": { "holding_years": { "eq": 0 } }, "priority": 1, "rate": { "type": "fixed", "ratePercent": «세율%» } },
      { "when": { "holding_years": { "eq": 1 } }, "priority": 0, "rate": { "type": "fixed", "ratePercent": «세율%» } }
    ]
  },
  "heavyRows": [
    { "when": { "house_count": { "eq": 2 } }, "priority": 0, "addPercentPoints": «가산 %p» },
    { "when": { "house_count": { "min": 3 } }, "priority": 1, "addPercentPoints": «가산 %p» }
  ]
}`,
  },
  [TRANSFER_RULE_KEYS.periodRule]: {
    title: '연수 계산 방식 — 보유·거주기간의 초일 산입 여부.',
    notes: [
      'dayInclusion: "include_start"(초일 산입 — 취득일이 1일차, N년 충족 최초일 = 취득일 + N년 − 1일) 또는 "exclude_start"(초일 불산입).',
      '양도소득세 집행기준 89-154-20은 "취득한 날의 초일을 산입하여 양도한 날까지"로 명시합니다 — 일반적으로 include_start를 근거와 함께 등록합니다.',
    ],
    skeleton: `{ "dayInclusion": "«include_start 또는 exclude_start»" }`,
  },
  [TRANSFER_RULE_KEYS.rounding]: {
    title: '단수 처리(선택) — 세액의 절사 단위·방식. 등록하지 않으면 1원 단위 버림입니다.',
    notes: ['unit: 절사 단위(원, 정수) / method: "floor"(버림)·"round"(반올림)·"ceil"(올림). 취득세와 같은 형식입니다.'],
    skeleton: `{ "unit": «단위(원)», "method": "floor" }`,
  },
}
