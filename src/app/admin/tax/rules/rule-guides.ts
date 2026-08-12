/**
 * @파일: admin/tax/rules/rule-guides.ts
 * @설명: 룰 키별 rule_value 입력 형식 안내 — 처음 등록하는 사람이 무엇을 어떤 형태로
 *        넣어야 하는지 화면에서 볼 수 있게 한다.
 *        ⚠️ 스켈레톤의 «...» 자리는 관리자가 법령을 확인하고 실제 값으로 바꿔 넣는
 *        자리표시자다. 실제 세율·금액 숫자는 여기(코드)에 절대 넣지 않는다.
 *        «...»를 남겨두면 JSON이 아니어서 저장이 거부된다(우연한 0원 저장 방지).
 */

import { ACQUISITION_RULE_KEYS } from '@/lib/tax/acquisition'
import { STAMP_RULE_KEYS } from '@/lib/tax/stamp'
import { COMMON_RULE_KEYS } from '@/lib/tax/rule-store'

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
  '사잇값 공식의 소수점 처리를 법령이 명시하면 linear_by_base 안에 "rounding": { "decimals": «소수점 자릿수», "method": "round" }를 추가하세요(method: "round" 반올림·"floor" 버림·"ceil" 올림). 지정하지 않으면 반올림하지 않습니다.',
  '감면이 있으면 행에 "credit": { "target": "acquisition", "amount": «감면액(원)» }을 추가합니다.',
  '값이 비어 있을 수 있는 조건(area_sqm·official_price·is_metro)을 쓴 행은, 사용자가 그 값을 입력하지 않으면 매칭되지 않고 결과에 "판정하지 못한 조건"으로 표시됩니다. 0이나 false로 간주하지 않습니다.',
]

/** 룰 키 → 안내 매핑 */
export const RULE_GUIDES: Record<string, RuleGuide> = {
  [ACQUISITION_RULE_KEYS.onerousRates]: {
    title: '유상취득(매매) 세율표 — 조건에 맞는 행 하나가 선택되어 3개 세목을 계산합니다.',
    notes: [
      '쓸 수 있는 조건 필드: price(취득가액·원), house_count(취득 후 주택 수), is_regulated(조정대상지역 여부 true/false), area_sqm(전용면적 ㎡·숫자 — 면적 기준은 min/max로 표현), official_price(공시가격=시가표준액·원 — 저가주택 중과 제외 판정용), is_metro(수도권 여부 true/false — 공통 세목의 region.metro_scope 룰이 등록돼 있어야 판정됩니다), first_home(생애최초 true/false), temporary_two_home(일시적 2주택 true/false), area_over_85(85㎡ 초과 true/false — 이전 형식 호환용, 새 룰은 area_sqm 사용 권장)',
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
    title: '증여 과세표준 기준 — 기본 기준 하나와, 필요하면 납세자 선택 가능 구간을 정합니다.',
    notes: [
      'base(기본 기준): "market_value"(시가인정액) 또는 "official_price"(공시가격=시가표준액).',
      '납세자가 기준을 고를 수 있는 규정이 있으면 choice를 추가하세요 — basis("price" 실제 지급대가·"market_value"·"official_price")로 지정한 값이 maxAmount(원) 이하일 때, options에 적은 기준 중에서 계산기 사용자가 직접 고를 수 있습니다.',
      '선택 규정이 없으면 choice 블록을 통째로 빼세요 — base 하나로 고정 계산합니다.',
      '기준이 바뀐 시점이 있으면 시행일을 달리해 룰을 나눠 등록하세요.',
    ],
    skeleton: `{
  "base": "market_value",
  "choice": {
    "basis": "official_price",
    "maxAmount": «금액(원)»,
    "options": ["market_value", "official_price"]
  }
}`,
  },
  [ACQUISITION_RULE_KEYS.giftRates]: {
    title: '증여 기본 세율표 — 중과가 아닐 때 적용됩니다.',
    notes: [
      '쓸 수 있는 조건 필드: tax_base(과세표준·원), house_count, is_regulated, donor_relation("spouse"/"lineal"/"other"), area_sqm(전용면적 ㎡·숫자), official_price(공시가격=시가표준액·원), is_metro(수도권 여부 true/false — region.metro_scope 룰 필요), area_over_85(이전 형식 호환용 — 새 룰은 area_sqm 사용 권장)',
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
  [STAMP_RULE_KEYS.rates]: {
    title: '인지세 세액표 — 계약금액 구간별 정액(원)이 붙습니다. 세율(%)이 아니라 금액입니다.',
    notes: [
      '쓸 수 있는 조건 필드: price(계약서 기재금액·원), is_housing(주택 여부 true/false)',
      '조건(when)은 eq(일치)·min/max(범위, 경계 포함)·in(목록) 연산자를 씁니다. 구간은 min/max로 표현하세요.',
      '여러 행이 동시에 맞으면 priority가 가장 큰 행이 적용됩니다(같으면 오류). 비과세 행처럼 구체적인 행일수록 priority를 크게 두세요.',
      'amount: 그 구간의 인지세액(원, 정액).',
      '비과세 행은 amount를 0으로 하고 exemptReason(비과세 사유 — 화면에 그대로 표시됩니다)을 반드시 함께 적으세요. 사유 없는 0원은 저장이 거부됩니다.',
      '계약서 1통 기준입니다. 주택/주택 외의 구간이 다르면 is_housing 조건으로 행을 나눠 등록하세요.',
    ],
    skeleton: `{
  "rows": [
    {
      "when": { "is_housing": { "eq": true }, "price": { "max": «금액(원)» } },
      "priority": 10,
      "amount": 0,
      "exemptReason": "«비과세 사유 — 법령 문구 요지»"
    },
    {
      "when": { "price": { "min": «금액(원)», "max": «금액(원)» } },
      "priority": 0,
      "amount": «인지세액(원)»
    }
  ]
}`,
  },
  [COMMON_RULE_KEYS.metroScope]: {
    title: '수도권 범위 — 수도권으로 취급할 시·도 이름 목록. 세율표의 is_metro 조건이 이 목록으로 판정됩니다.',
    notes: [
      '세목을 반드시 "공통 (전 세목)"으로 두고 등록하세요. 특정 세목에 넣으면 다른 세목 계산에서 조회되지 않습니다.',
      '시·도 이름은 계산기 소재지 드롭다운의 시·도 표기와 글자까지 똑같이 적어야 합니다(띄어쓰기·"특별시/광역시/도" 포함).',
      '이 룰이 없으면 is_metro 조건을 쓴 세율 행은 매칭되지 않고 결과에 "판정하지 못한 조건: 수도권 여부"로 표시됩니다. 임의로 비수도권 처리하지 않습니다.',
      '수도권 범위를 정의한 법령을 근거(법령명·조문·원문 링크)로 입력하세요.',
    ],
    skeleton: `{
  "sidoNames": [«"시·도 이름", "시·도 이름", ...»]
}`,
  },
}

/** 취득세에서 선택할 수 있는 룰 키 목록 (안내 존재 순서) */
export const KNOWN_ACQUISITION_KEYS: string[] = Object.values(ACQUISITION_RULE_KEYS)

/** 공통(전 세목)에서 선택할 수 있는 룰 키 목록 */
export const KNOWN_COMMON_KEYS: string[] = Object.values(COMMON_RULE_KEYS)

/** 인지세에서 선택할 수 있는 룰 키 목록 */
export const KNOWN_STAMP_KEYS: string[] = Object.values(STAMP_RULE_KEYS)

/**
 * @함수명: knownKeysForTaxType
 * @설명: 세목별로 안내가 준비된 룰 키 목록을 돌려줍니다. 빈 배열이면 직접 입력만 가능합니다.
 */
export function knownKeysForTaxType(taxType: string): string[] {
  if (taxType === 'acquisition') return KNOWN_ACQUISITION_KEYS
  if (taxType === 'stamp') return KNOWN_STAMP_KEYS
  if (taxType === 'common') return KNOWN_COMMON_KEYS
  return []
}
