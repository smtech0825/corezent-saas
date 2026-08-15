'use client'

/**
 * @컴포넌트: ComprehensiveComparisonCards
 * @설명: 종합부동산세 연도별 비교 어댑터 + 비교 전용 개정안 입력 패널.
 *        서버 액션이 준 비교 묶음을 공용 카드 데이터로 정규화해 YearComparisonSection에
 *        넘긴다. '왜 달라졌는지 한 줄'의 수치(기본공제액·세액공제율)는 전부 엔진
 *        결과(=등록된 룰)에서 온다 — 이 파일에 세율·공제율·연도 숫자를 넣지 않는다.
 *        ⚠️ 확정법 모드에서 개정안 해가 실패하는 이유: 개정안 기본공제 룰의 1세대 1주택
 *        행들이 '거주 여부' 조건을 쓰는데 확정법 화면은 그 값을 받지 않아 행이 잡히지
 *        않는다(조건 없는 산식 행으로 떨어져 거주 주택 공시가격을 요구). 그래서 실패
 *        카드를 보여주는 대신 이 자리에서 필요한 값만 받아 비교만 다시 계산한다 —
 *        확정법으로 계산하러 온 사람의 입력을 늘리지 않으면서(폼 본문은 그대로),
 *        비교를 보려는 사람은 여기서 바로 볼 수 있다. 본 계산 결과와 계산 이력은
 *        건드리지 않는다(재계산은 비교 전용 액션 — 이력 미기록).
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import YearComparisonSection, { type YearCardData } from '../_components/YearComparisonSection'
import {
  RegulatedSelect,
  ResidenceYearsField,
  ResidingPriceField,
  ResidingSelect,
  validateProposedInputs,
  type YesNo,
} from './ProposedFields'
import { calculateComprehensiveComparison, type ComprehensiveCalcPayload } from './actions'
import type { YearComparison } from '@/lib/tax/year-comparison'
import type { ComprehensiveSuccess } from '@/lib/tax/comprehensive-types'
import type { TaxEngineErrorCode } from '@/lib/tax/engine-types'

/** 값을 더 받으면 풀릴 수 있는 실패 코드 — 룰 미등록·DB 오류 등은 입력으로 해결되지 않는다 */
const INPUT_FIXABLE_CODES: TaxEngineErrorCode[] = ['INVALID_INPUT', 'NO_MATCHING_RATE_ROW']

/**
 * 이 패널이 실제로 받을 수 있는 판정 컨텍스트 필드 — 엔진의 미확정 필드가 이 목록에
 * 들어야만 입력을 요청한다. 그러지 않으면 패널로 못 채우는 조건(나이·보유기간 등)까지
 * 입력을 요구해, 채워도 사라지지 않는 안내가 남는다.
 */
const PANEL_FIXABLE_FIELDS = ['residence_years', 'is_residing', 'residing_official_price', 'has_regulated_house']

/** 그 해의 결과가 왜 이 값인지 한 줄 — 비과세면 사유, 과세면 공제·중과 요약 */
function reasonLine(r: ComprehensiveSuccess): string {
  if (!r.taxable) return r.notTaxableReason ?? '과세 대상 아님'
  const parts: string[] = [`기본공제 ${r.basicDeductionApplied.toLocaleString('ko-KR')}원`]
  if (r.taxCredit) parts.push(`세액공제 ${r.taxCredit.totalPercentApplied}%`)
  if (r.heavyTableApplied) parts.push('중과 세율')
  return parts.join(' · ')
}

/**
 * @함수명: toCards
 * @설명: 비교 묶음을 카드 데이터로 옮깁니다. 값을 더 받으면 계산되는 해는 실패 원문 대신
 *        입력 안내 카드로 표시합니다(pendingInput).
 * @매개변수: comparison - 비교 묶음 / pendingInput - 입력 대기 상태인지
 * @반환값: 카드 데이터 배열
 */
function toCards(comparison: YearComparison<ComprehensiveSuccess>, pendingInput: boolean): YearCardData[] {
  return comparison.entries.map((e) =>
    e.result.ok
      ? {
          year: e.year,
          ruleMode: e.ruleMode,
          isBaseYear: e.isBaseYear,
          ok: true,
          totalTax: e.result.breakdown.total,
          reasonLine: reasonLine(e.result),
          hasUnresolved: e.result.unresolvedFields.length > 0,
        }
      : {
          year: e.year,
          ruleMode: e.ruleMode,
          isBaseYear: e.isBaseYear,
          ok: false,
          failMessage: e.result.message,
          // 입력 대기 중이면 실패 원문(예: 산식 필드명) 대신 무엇을 하면 되는지 알린다
          pendingInput: pendingInput && !e.isBaseYear && INPUT_FIXABLE_CODES.includes(e.result.code),
        },
  )
}

export default function ComprehensiveComparisonCards({ payload, comparison }: {
  /** 본 계산에 쓴 페이로드 — 비교 재계산이 같은 조건을 그대로 다시 쓴다 */
  payload: ComprehensiveCalcPayload
  comparison: YearComparison<ComprehensiveSuccess>
}) {
  // 비교 전용 개정안 입력 — 폼 본문의 개정안 입력과 별개다(확정법 화면은 그것을 렌더하지 않는다)
  const [isResiding, setIsResiding] = useState<YesNo>('')
  const [residenceYears, setResidenceYears] = useState('')
  const [residingPrice, setResidingPrice] = useState('')
  const [hasRegulated, setHasRegulated] = useState<YesNo>('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [recalculated, setRecalculated] = useState<YearComparison<ComprehensiveSuccess> | null>(null)
  const [isPending, startTransition] = useTransition()
  // 재계산 요청 일련번호 — 응답이 늦게 도착한 옛 요청이 새 결과를 덮어쓰지 않게 한다
  const requestSeq = useRef(0)
  // 새 본 계산이 오면 이전 재계산 결과를 버린다 (props 변화에 맞춘 상태 조정)
  const [prevComparison, setPrevComparison] = useState(comparison)
  if (prevComparison !== comparison) {
    setPrevComparison(comparison)
    setRecalculated(null)
    setInputError(null)
  }
  // 진행 중이던 재계산 응답 무효화는 커밋 후에 한다 — 렌더 중 ref를 바꾸면 폐기된 렌더에서도
  // 번호가 올라가 정상 요청이 조용히 버려질 수 있다(동시성 렌더)
  useEffect(() => { requestSeq.current += 1 }, [comparison])

  const current = recalculated ?? comparison
  const oneHouseTrack = payload.isOneHouse === true
  // 개정안 해가 값을 더 받으면 풀릴 상태인지 — 확정법으로 계산한 경우에만 묻는다
  // (개정안 모드는 폼 본문에서 이미 같은 값을 받아 검증한다).
  // 실패뿐 아니라 '성공했지만 판정 못 한 조건이 남은 해'도 포함한다 — 값을 넣으면 정확해진다.
  const needsInput =
    payload.ruleMode === 'confirmed' &&
    current.entries.some(
      (e) =>
        !e.isBaseYear &&
        (e.result.ok
          ? e.result.unresolvedFields.some((f) => PANEL_FIXABLE_FIELDS.includes(f))
          : INPUT_FIXABLE_CODES.includes(e.result.code)),
    )
  // 아직 한 번도 입력받지 못한 상태에서만 '입력하면 계산됩니다' 카드를 쓴다 —
  // 재계산까지 했는데도 실패했다면 그 사유를 그대로 보여줘야 한다(원인을 감추지 않는다)
  const awaitingFirstInput = needsInput && recalculated === null

  /**
   * @함수명: handleApply
   * @설명: 비교 전용 입력을 검증하고 비교만 다시 계산합니다. 본 계산 결과·이력은
   *        건드리지 않습니다(비교 전용 액션 호출).
   */
  function handleApply() {
    setInputError(null)
    const checked = validateProposedInputs({
      oneHouseTrack, hasRegulated, isResiding, residenceYears, residingPrice,
      holdingNum: payload.holdingYears, priceNum: payload.totalOfficialPrice,
    })
    if (checked.error !== undefined) { setInputError(checked.error); return }

    requestSeq.current += 1
    const seq = requestSeq.current
    startTransition(async () => {
      try {
        const res = await calculateComprehensiveComparison({
          ...payload,
          comparisonProposedInputs: {
            residenceYears: oneHouseTrack ? checked.residenceNum : undefined,
            isResiding: oneHouseTrack ? isResiding === 'yes' : undefined,
            residingOfficialPrice: oneHouseTrack ? undefined : checked.residingPriceNum,
            hasRegulatedHouse: hasRegulated === 'yes',
          },
        })
        if (seq !== requestSeq.current) return   // 그 사이 새 본 계산이 왔다 — 옛 응답은 버린다
        if (res.comparison) setRecalculated(res.comparison)
        else setInputError('비교를 다시 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      } catch {
        if (seq === requestSeq.current) setInputError('비교 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })
  }

  // 이 비교의 한계 — 차이를 전부 '개정안 때문'으로 읽지 않도록 근거를 밝힌다
  const notes: string[] = [
    '나이·보유기간·거주기간과 직전 연도 총세액은 과세연도가 바뀌어도 그대로 둡니다 — 실제로는 해마다 나이와 기간이 늘어 세액공제가 더 커질 수 있습니다.',
  ]
  // 위 결과와 카드가 어긋날 수 있는 두 경우를 구분해 알린다 — 같은 숫자가 아닌 이유를 모르면
  // 사용자가 어느 쪽을 자기 세금으로 봐야 할지 알 수 없다
  const sameYearCard = current.entries.find((e) => e.year === current.inputYear)
  if (!sameYearCard) {
    notes.push(
      `위에서 계산한 ${current.inputYear}년은 이 비교에 없습니다 — 비교는 올해와 개편안 시행 연도만 보여드립니다.`,
    )
  } else if (sameYearCard.ruleMode !== current.inputRuleMode) {
    notes.push(
      `${current.inputYear}년 카드는 ${sameYearCard.ruleMode === 'confirmed' ? '확정된 법' : '개정안'} 기준이라 위 결과와 금액이 다를 수 있습니다.`,
    )
  }

  return (
    <YearComparisonSection
      subtitle="입력하신 내용에서 과세연도만 바꿔 다시 계산한 결과입니다. 올해는 확정된 법, 나머지 해는 개정안 기준입니다."
      notes={notes}
      cards={toCards(current, awaitingFirstInput)}
    >
      {/* 개편안 해를 계산하려면 확정법 화면에 없는 값이 필요하다 — 그 값만 여기서 받는다
          (폼 본문 입력은 늘리지 않는다). 카드는 아래에 그대로 두어 올해 결과는 계속 보인다 */}
      {needsInput && (
        <div className="bg-paper-raised border border-rule rounded-lg p-5 space-y-4 mb-4">
          <div>
            <p className="text-sm font-semibold text-ink mb-1">개편안 기준으로 비교하려면 아래를 입력하세요</p>
            <p className="text-xs text-ink-soft leading-relaxed">
              개편안은 지금 확정된 법에는 없는 조건(거주 여부 등)으로 공제를 정합니다. 그래서
              확정된 법 기준 계산에 필요 없던 값이 비교에는 필요합니다. 아래를 채우면 개편안
              시행 연도의 세액을 계산해 나란히 보여드립니다 — 위에 나온 계산 결과는 바뀌지 않습니다.
              다만 개편안은 아직 국회 통과 전이라 그 세액은 확정이 아닙니다.
            </p>
          </div>
          {oneHouseTrack ? (
            <>
              <ResidingSelect value={isResiding} onChange={setIsResiding} />
              <ResidenceYearsField value={residenceYears} onChange={setResidenceYears} />
            </>
          ) : (
            <ResidingPriceField value={residingPrice} onChange={setResidingPrice} />
          )}
          <RegulatedSelect value={hasRegulated} onChange={setHasRegulated} />
          {inputError && <p className="text-sm font-medium text-seal" role="alert">{inputError}</p>}
          <Button type="button" onClick={handleApply} disabled={isPending}>
            {isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isPending ? '비교 계산 중…' : '연도별 비교 계산하기'}
          </Button>
        </div>
      )}
    </YearComparisonSection>
  )
}
