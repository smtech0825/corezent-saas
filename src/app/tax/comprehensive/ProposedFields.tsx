'use client'

/**
 * @파일: tax/comprehensive/ProposedFields.tsx
 * @설명: 종합부동산세 개정안(2026 세제개편안) 모드 전용 입력 4종과 그 검증 —
 *        ComprehensiveForm의 300줄 규칙 준수를 위해 분리했다. 상태는 폼이 소유하고
 *        여기는 표시·검증만 담당한다.
 *        노출 조건(폼이 판단): 거주 여부·거주기간 = 1세대 1주택 트랙,
 *        거주 중인 주택의 공시가격 = 1세대 1주택이 아닌 전부(개편안 원문 p.61의
 *        "❶ 1세대 1주택자 / ❷ ❶ 외" — 주택 수가 1이어도 1세대 1주택이 아니면 산식 대상),
 *        조정대상지역 보유 = 전부(자기신고 — 주소를 받지 않아 자동 판정 불가).
 */

import { Field, Input } from '@/components/ui/Input'

/** Input과 톤을 맞춘 select 클래스 (다른 계산기 폼과 동일 — 파일 분리로 인한 소형 중복) */
const SELECT_CLS =
  'w-full rounded-md border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink transition-colors focus:border-pen focus:ring-2 focus:ring-pen/15 focus:outline-none disabled:opacity-50'

/** 예/아니오 명시 선택 값 — 빈 문자열은 미선택(기본값을 두지 않는다) */
export type YesNo = '' | 'yes' | 'no'

/** 문자열 → 숫자. 빈 값은 undefined (폼과 동일 — 파일 분리로 인한 소형 중복) */
function toNum(v: string): number | undefined {
  if (v.trim() === '') return undefined
  return Number(v)
}

/** ㉠ 1세대 1주택 — 현재 거주 여부 (개정안 기본공제가 거주/비거주로 갈린다) */
export function ResidingSelect({ value, onChange }: { value: YesNo; onChange: (v: YesNo) => void }) {
  return (
    <Field label="이 주택에 현재 거주 중인지" htmlFor="cp-residing" required
      hint="개정안 기본공제는 거주 여부로 갈립니다 — 실제 거주 기준으로 선택하세요.">
      <select id="cp-residing" className={SELECT_CLS} value={value}
        onChange={(e) => onChange(e.target.value as YesNo)}>
        <option value="">선택</option>
        <option value="yes">예 — 이 주택에 거주 중</option>
        <option value="no">아니요 — 거주하지 않음</option>
      </select>
    </Field>
  )
}

/** ㉣ 1세대 1주택 — 거주기간(만 연수). 보유기간과 나란히 두어 확정법=보유·개정안=거주 구분 */
export function ResidenceYearsField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="거주기간 (만 연수)" htmlFor="cp-residence" required
      hint="해당 주택에 실제 거주한 만 연수 — 개정안(거주 기준) 세액공제 판정용. 확정법 계산에는 쓰이지 않습니다.">
      <Input id="cp-residence" type="number" min={0} step={1} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder="예: 5" required />
    </Field>
  )
}

/** ㉡ 1세대 1주택이 아닌 경우 — 거주 중인 주택의 공시가격 (산식 분자, 비거주면 0) */
export function ResidingPriceField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-4 border-l-2 border-pen/20 pl-4">
      <Field label="현재 거주 중인 주택의 공시가격 (원)" htmlFor="cp-residing-price" required
        hint="개정안에서 1세대 1주택이 아닌 경우의 기본공제 산식에 쓰입니다 — 거주 중인 주택의 공시가격 비중이 공제에 반영됩니다. 보유 주택 어디에도 거주하지 않으면 0을 입력하세요.">
        <Input id="cp-residing-price" type="number" min={0} step={1} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder="예: 800000000" required />
        {value !== '' && !Number.isNaN(Number(value)) && (
          <p className="text-xs text-ink-faint mt-1">{Number(value).toLocaleString('ko-KR')}원</p>
        )}
      </Field>
    </div>
  )
}

/** ㉢ 조정대상지역 주택 보유 여부 — 자기신고 (주소를 받지 않아 자동 판정 불가) */
export function RegulatedSelect({ value, onChange }: { value: YesNo; onChange: (v: YesNo) => void }) {
  return (
    <Field label="조정대상지역 내 주택 보유 여부" htmlFor="cp-regulated" required
      hint="개정안 공정시장가액비율 등의 판정에 쓰입니다. 이 계산기는 주택 주소를 받지 않아 지정 여부를 자동으로 판정할 수 없습니다 — 보유 주택 중 한 채라도 조정대상지역에 있으면 '예'를 선택하세요. 지정 현황은 국토교통부 공고에서 확인할 수 있습니다.">
      <select id="cp-regulated" className={SELECT_CLS} value={value}
        onChange={(e) => onChange(e.target.value as YesNo)}>
        <option value="">선택</option>
        <option value="yes">예 — 조정대상지역 주택 보유</option>
        <option value="no">아니요 — 없음</option>
      </select>
    </Field>
  )
}

/**
 * @함수명: validateProposedInputs
 * @설명: 개정안 모드 전용 입력을 검증합니다 — 확정법 모드에서는 호출하지 않습니다.
 *        선택 강제(자기신고·거주 여부)와 숫자 범위, 거주≤보유·거주 주택 공시가격≤합계를
 *        검사하고, 통과하면 페이로드에 넣을 숫자 값을 돌려줍니다.
 * @매개변수: args - 폼 상태 (oneHouseTrack, 선택 값들, 보유기간·공시가격 합계 숫자)
 * @반환값: { error } 또는 { residenceNum?, residingPriceNum? }
 */
export function validateProposedInputs(args: {
  oneHouseTrack: boolean
  hasRegulated: YesNo
  isResiding: YesNo
  residenceYears: string
  residingPrice: string
  holdingNum: number | undefined
  priceNum: number
}): { error: string } | { error?: undefined; residenceNum?: number; residingPriceNum?: number } {
  if (args.hasRegulated === '') {
    return { error: '조정대상지역 내 주택 보유 여부를 선택해 주세요. 주소를 받지 않아 자동으로 판정할 수 없습니다.' }
  }
  let residenceNum: number | undefined
  let residingPriceNum: number | undefined
  if (args.oneHouseTrack) {
    if (args.isResiding === '') {
      return { error: '이 주택에 현재 거주 중인지 선택해 주세요. 개정안 기본공제 판정에 필요합니다.' }
    }
    residenceNum = toNum(args.residenceYears)
    if (residenceNum === undefined || Number.isNaN(residenceNum) || residenceNum < 0) {
      return { error: '개정안 세액공제 판정에는 거주기간(만 연수)을 입력해야 합니다.' }
    }
    if (args.holdingNum !== undefined && residenceNum > args.holdingNum) {
      return { error: '거주기간이 보유기간보다 길 수 없습니다. 입력을 확인해 주세요.' }
    }
  } else {
    // 1세대 1주택이 아닌 전부 — 개편안 원문 ❷('❶ 외')가 산식 대상이라 주택 수 1이어도 받는다
    residingPriceNum = toNum(args.residingPrice)
    if (residingPriceNum === undefined || Number.isNaN(residingPriceNum) || residingPriceNum < 0) {
      return { error: '현재 거주 중인 주택의 공시가격을 입력해 주세요. 거주하지 않으면 0을 입력합니다.' }
    }
    if (residingPriceNum > args.priceNum) {
      return { error: '현재 거주 중인 주택의 공시가격이 공시가격 합계를 넘을 수 없습니다.' }
    }
  }
  return { residenceNum, residingPriceNum }
}
