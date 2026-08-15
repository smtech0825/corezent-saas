/**
 * @파일: lib/tax/amount-spec.ts
 * @설명: 금액 명세(AmountSpec) — rule_value 안에서 '금액(원)'을 산출하는 구성 요소.
 *        RateSpec(세율%)의 금액 버전이다. 두 유형을 지원한다:
 *          fixed           — 고정 금액: 금액 = amount
 *          base_plus_share — 기준액 + 가산액 × 비중:
 *                            금액 = baseAmount + bonusAmount × (분자 필드 값 ÷ 분모 필드 값)
 *                            비중은 0~1로 잘라 적용한다(비중이 100%를 넘을 수 없다는 구조만 코드가 안다).
 *        ⚠️ 기준액·가산액 숫자와 분자·분모의 컨텍스트 필드명은 전부 룰(관리자 입력)에서 온다 —
 *        이 파일에 어떤 금액·필드명도 넣지 않는다.
 *        (2026년 세제개편안의 종부세 다주택 기본공제 산식을 담기 위해 신설 —
 *        다른 세목에 금액 산식 룰이 생기면 이 유형을 공유한다)
 */

import type { Json } from './types'
import type { TaxEngineFailure } from './engine-types'
import { engineFail } from './rule-store'

/** 유한한 숫자인지 검사 (rule-value.ts와 동일 — 파일 분리로 인한 소형 중복) */
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 순수 객체(배열 제외)인지 검사 (rule-value.ts와 동일 — 파일 분리로 인한 소형 중복) */
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * @타입: AmountSpec
 * @설명: 금액(원) 산출 명세. fixed는 고정 금액, base_plus_share는
 *        '기준액 + 가산액 × (분자 필드 ÷ 분모 필드)' 산식이다.
 *        분자·분모는 엔진의 판정 컨텍스트 필드명을 룰에서 지정한다.
 */
export type AmountSpec =
  | { type: 'fixed'; amount: number }
  | {
      type: 'base_plus_share'
      baseAmount: number        // 기준액 (원) — 관리자 입력
      bonusAmount: number       // 가산액 (원) — 관리자 입력
      numeratorField: string    // 비중의 분자가 되는 판정 컨텍스트 필드명 — 룰에서 지정
      denominatorField: string  // 비중의 분모가 되는 판정 컨텍스트 필드명 — 룰에서 지정
    }

/**
 * @함수명: checkAmountSpec
 * @설명: AmountSpec 구조를 검증합니다 — 통과하면 null, 실패하면 사유 문자열.
 *        금액 0 이하는 거부합니다(공제 0원이 정상 결과처럼 보이는 함정 차단 —
 *        다른 세목 검증기의 '0 거부'와 같은 취지).
 */
export function checkAmountSpec(spec: unknown): string | null {
  if (!isObj(spec)) return '금액 명세가 객체가 아닙니다.'
  if (spec.type === 'fixed') {
    if (!isNum(spec.amount) || spec.amount <= 0) return 'fixed 금액의 amount가 0보다 큰 숫자(원)가 아닙니다.'
    return null
  }
  if (spec.type === 'base_plus_share') {
    if (!isNum(spec.baseAmount) || spec.baseAmount <= 0) {
      return 'base_plus_share의 baseAmount(기준액)가 0보다 큰 숫자(원)가 아닙니다.'
    }
    if (!isNum(spec.bonusAmount) || spec.bonusAmount <= 0) {
      return 'base_plus_share의 bonusAmount(가산액)가 0보다 큰 숫자(원)가 아닙니다. 가산이 없으면 fixed로 등록하세요.'
    }
    if (typeof spec.numeratorField !== 'string' || spec.numeratorField.trim() === '') {
      return 'base_plus_share의 numeratorField(분자 필드명)가 비어 있지 않은 문자열이 아닙니다.'
    }
    if (typeof spec.denominatorField !== 'string' || spec.denominatorField.trim() === '') {
      return 'base_plus_share의 denominatorField(분모 필드명)가 비어 있지 않은 문자열이 아닙니다.'
    }
    if (spec.numeratorField === spec.denominatorField) {
      return 'base_plus_share의 분자·분모 필드가 같습니다 — 비중이 항상 100%가 되어 산식이 무의미합니다.'
    }
    return null
  }
  return `알 수 없는 금액 유형('${String((spec as Record<string, unknown>).type)}')입니다.`
}

/**
 * @함수명: evaluateAmountSpec
 * @설명: 금액 명세를 판정 컨텍스트에 적용해 금액(원, 정수 버림)을 계산합니다.
 *        - 산식 필드가 컨텍스트에 아예 없으면(관리자 오타 가능성) RULE_VALUE_INVALID로 중단
 *        - 필드 값이 미확정(undefined — 사용자 미입력)이면 0으로 간주하지 않고
 *          INVALID_INPUT으로 어떤 값이 필요한지 알립니다
 *        - 비중은 0~1로 잘라 적용합니다(분자가 분모를 넘는 입력의 이중 방어)
 * @매개변수: spec - 금액 명세(룰 값) / context - 판정 컨텍스트(undefined=미확정) / ruleKey - 안내문용 룰 키
 * @반환값: 금액(원) 또는 실패(한국어 안내)
 */
export function evaluateAmountSpec(
  spec: AmountSpec,
  context: Record<string, Json | undefined>,
  ruleKey: string,
): { ok: true; amount: number } | TaxEngineFailure {
  if (spec.type === 'fixed') return { ok: true, amount: spec.amount }

  const resolved: number[] = []
  for (const field of [spec.numeratorField, spec.denominatorField]) {
    if (!(field in context)) {
      return engineFail(
        'RULE_VALUE_INVALID',
        `룰('${ruleKey}')의 금액 산식 필드 '${field}'는 엔진이 지원하지 않는 필드입니다. (지원: ${Object.keys(context).join(', ')}) 관리자 화면에서 룰 값을 수정해 주세요.`,
        ruleKey,
      )
    }
    const v = context[field]
    if (v === undefined) {
      // 미입력을 0으로 간주하지 않는다 — 어떤 값이 필요한지 그대로 알린다
      return engineFail(
        'INVALID_INPUT',
        `금액 산식에 필요한 값('${field}')이 입력되지 않았습니다. 해당 값을 입력해 주세요(해당 없음이면 0).`,
      )
    }
    if (!isNum(v)) {
      return engineFail(
        'RULE_VALUE_INVALID',
        `룰('${ruleKey}')의 금액 산식 필드 '${field}'가 숫자 값이 아니라 산식을 계산할 수 없습니다. 관리자 화면에서 룰 값을 수정해 주세요.`,
        ruleKey,
      )
    }
    resolved.push(v)
  }

  const [numerator, denominator] = resolved
  if (denominator <= 0) {
    return engineFail(
      'INVALID_INPUT',
      `금액 산식의 분모('${spec.denominatorField}')가 0 이하라 비중을 구할 수 없습니다. 입력을 확인해 주세요.`,
    )
  }
  const share = Math.min(Math.max(numerator / denominator, 0), 1)
  return { ok: true, amount: Math.floor(spec.baseAmount + spec.bonusAmount * share) }
}
