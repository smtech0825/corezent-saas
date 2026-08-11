/**
 * @파일: admin/tax/rules/rule-guides.ts
 * @설명: 룰 키별 rule_value 입력 형식 안내 — 처음 등록하는 사람이 무엇을 어떤 형태로
 *        넣어야 하는지 화면에서 볼 수 있게 한다.
 *        ⚠️ 스켈레톤의 «...» 자리는 관리자가 법령을 확인하고 실제 값으로 바꿔 넣는
 *        자리표시자다. 실제 세율·금액 숫자는 여기(코드)에 절대 넣지 않는다.
 *        «...»를 남겨두면 JSON이 아니어서 저장이 거부된다(우연한 0원 저장 방지).
 */

import { ACQUISITION_RULE_KEYS } from '@/lib/tax/acquisition'

/** 룰 키 하나의 안내 */
export interface RuleGuide {
  /** 이 룰이 무엇인지 한 줄 설명 */
  title: string
  /** 형식 설명 (조건 필드·세율 유형 등) */
  notes: string[]
  /** 복사해서 채워 넣는 JSON 스켈레톤 — «...» 자리표시자 포함 */
  skeleton: string
}

/** 세율표(rows) 공통 안내 문구 */
const TABLE_NOTES = [
  '조건(when)은 eq(일치)·min/max(범위, 경계 포함)·in(목록) 연산자를 씁니다.',
  '여러 행이 동시에 맞으면 priority가 가장 큰 행이 적용됩니다(같으면 오류). 구체적인 행일수록 priority를 크게 두세요.',
  "세율 유형: fixed = { \"type\": \"fixed\", \"ratePercent\": «세율%» } / 사잇값 공식 = { \"type\": \"linear_by_base\", \"per\": «나눔단위(원)», \"slopePercent\": «기울기», \"interceptPercent\": «절편», \"minPercent\": «하한%», \"maxPercent\": «상한%» } — 세율% = slope×(과세표준÷per)+intercept",
  '감면이 있으면 행에 "credit": { "target": "acquisition", "amount": «감면액(원)» }을 추가합니다.',
]

/** 룰 키 → 안내 매핑 */
export const RULE_GUIDES: Record<string, RuleGuide> = {
  [ACQUISITION_RULE_KEYS.onerousRates]: {
    title: '유상취득(매매) 세율표 — 조건에 맞는 행 하나가 선택되어 3개 세목을 계산합니다.',
    notes: [
      '쓸 수 있는 조건 필드: price(취득가액·원), house_count(취득 후 주택 수), is_regulated(조정대상지역 여부 true/false), area_over_85(85㎡ 초과 true/false), first_home(생애최초 true/false), temporary_two_home(일시적 2주택 true/false)',
      ...TABLE_NOTES,
    ],
    skeleton: `{
  "rows": [
    {
      "when": {
        "house_count": { "max": «주택수» },
        "is_regulated": { "eq": false },
        "price": { "max": «금액(원)» }
      },
      "priority": 0,
      "rates": {
        "acquisition":     { "type": "fixed", "ratePercent": «세율%» },
        "local_education": { "type": "fixed", "ratePercent": «세율%» },
        "rural_special":   { "type": "fixed", "ratePercent": «세율%» }
      }
    }
  ]
}`,
  },
  [ACQUISITION_RULE_KEYS.giftTaxBase]: {
    title: '증여 과세표준 기준 — 시가인정액과 공시가격 중 무엇을 과세표준으로 쓸지 정합니다.',
    notes: [
      '"market_value"(시가인정액) 또는 "official_price"(공시가격) 중 하나만 넣습니다.',
      '기준이 바뀐 시점이 있으면 시행일을 달리해 룰을 나눠 등록하세요.',
    ],
    skeleton: `{ "base": "market_value" }`,
  },
  [ACQUISITION_RULE_KEYS.giftRates]: {
    title: '증여 기본 세율표 — 중과가 아닐 때 적용됩니다.',
    notes: [
      '쓸 수 있는 조건 필드: tax_base(과세표준·원), house_count, is_regulated, area_over_85, donor_relation("spouse"/"lineal"/"other")',
      ...TABLE_NOTES,
    ],
    skeleton: `{
  "rows": [
    {
      "when": { "area_over_85": { "eq": false } },
      "priority": 0,
      "rates": {
        "acquisition":     { "type": "fixed", "ratePercent": «세율%» },
        "local_education": { "type": "fixed", "ratePercent": «세율%» },
        "rural_special":   { "type": "fixed", "ratePercent": «세율%» }
      }
    }
  ]
}`,
  },
  [ACQUISITION_RULE_KEYS.giftHeavy]: {
    title: '증여 중과 — 조정대상지역이고 공시가격이 기준액 이상이면 이 세율표가 적용됩니다(증여자 1주택자는 제외).',
    notes: [
      'officialPriceMin: 중과가 적용되는 공시가격 하한(원).',
      '조건 필드는 증여 기본 세율표와 같습니다.',
      ...TABLE_NOTES,
    ],
    skeleton: `{
  "officialPriceMin": «공시가격 기준액(원)»,
  "rows": [
    {
      "when": {},
      "priority": 0,
      "rates": {
        "acquisition":     { "type": "fixed", "ratePercent": «세율%» },
        "local_education": { "type": "fixed", "ratePercent": «세율%» },
        "rural_special":   { "type": "fixed", "ratePercent": «세율%» }
      }
    }
  ]
}`,
  },
  [ACQUISITION_RULE_KEYS.deemedGiftThreshold]: {
    title: '무상취득 간주 기준 — 배우자·직계존비속 간 대가 지급 거래에서 차액(시가인정액−대가)이 기준을 넘으면 증여로 간주합니다.',
    notes: [
      'mode: "any"(기준 중 하나만 넘어도 간주) 또는 "all"(전부 넘어야 간주).',
      'minDiffAmount(차액 기준 금액·원)·minDiffRatioPercent(시가인정액 대비 차액 비율 %) 중 하나 이상을 넣습니다.',
    ],
    skeleton: `{
  "mode": "any",
  "minDiffAmount": «금액(원)»,
  "minDiffRatioPercent": «비율%»
}`,
  },
  [ACQUISITION_RULE_KEYS.rounding]: {
    title: '단수 처리(선택) — 세목별 세액의 절사 단위·방식. 등록하지 않으면 1원 단위 버림입니다.',
    notes: ['unit: 절사 단위(원, 정수) / method: "floor"(버림)·"round"(반올림)·"ceil"(올림)'],
    skeleton: `{ "unit": «단위(원)», "method": "floor" }`,
  },
}

/** 취득세에서 선택할 수 있는 룰 키 목록 (안내 존재 순서) */
export const KNOWN_ACQUISITION_KEYS = Object.keys(RULE_GUIDES)
