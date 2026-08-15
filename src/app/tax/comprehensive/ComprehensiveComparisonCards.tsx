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

import { useState, useTransition } from 'react'
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

/** 그 해의 결과가 왜 이 값인지 한 줄 — 비과세면 사유, 과세면 공제·중과 요약 */
function reasonLine(r: ComprehensiveSuccess): string {
  if (!r.taxable) return r.notTaxableReason ?? '과세 대상 아님'
  const parts: string[] = [`기본공제 ${r.basicDeductionApplied.toLocaleString('ko-KR')}원`]
  if (r.taxCredit) parts.push(`세액공제 ${r.taxCredit.totalPercentApplied}%`)
  if (r.heavyTableApplied) parts.push('중과 세율')
  return parts.join(' · ')
}

/** 비교 묶음 → 카드 데이터 */
function toCards(comparison: YearComparison<ComprehensiveSuccess>): YearCardData[] {
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
  // 새 본 계산이 오면 이전 재계산 결과를 버린다 (props 변화에 맞춘 상태 조정)
  const [prevComparison, setPrevComparison] = useState(comparison)
  if (prevComparison !== comparison) {
    setPrevComparison(comparison)
    setRecalculated(null)
    setInputError(null)
  }

  const current = recalculated ?? comparison
  const oneHouseTrack = payload.isOneHouse === true
  // 개정안 해가 '값을 더 받으면 풀릴 수 있는' 이유로 실패했는지 — 확정법으로 계산한 경우에만 묻는다
  // (개정안 모드는 폼 본문에서 이미 같은 값을 받아 검증한다)
  const needsInput =
    payload.ruleMode === 'confirmed' &&
    current.entries.some((e) => !e.isBaseYear && !e.result.ok && INPUT_FIXABLE_CODES.includes(e.result.code))

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
        if (res.comparison) setRecalculated(res.comparison)
        else setInputError('비교를 다시 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      } catch {
        setInputError('비교 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })
  }

  return (
    <>
      {needsInput && (
        <section aria-label="연도별 비교" className="mt-8">
          <h2 className="font-serif font-bold text-ink mb-1">연도별 비교</h2>
          <p className="text-xs text-ink-soft mb-3 leading-relaxed">
            해마다 세금이 어떻게 달라지는지 한 화면에서 비교합니다.
          </p>
          <div className="bg-paper-raised border border-rule rounded-lg p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-ink mb-1">개편안 기준으로 비교하려면 아래를 입력하세요</p>
              <p className="text-xs text-ink-soft leading-relaxed">
                개편안은 지금 확정된 법에는 없는 조건(거주 여부 등)으로 공제를 정합니다. 그래서
                확정된 법 기준 계산에 필요 없던 값이 비교에는 필요합니다. 아래를 채우면 개편안
                시행 연도의 세액을 계산해 나란히 보여드립니다 — 위에 나온 계산 결과는 바뀌지 않습니다.
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
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {isPending ? '비교 계산 중…' : '연도별 비교 계산하기'}
            </Button>
          </div>
        </section>
      )}

      {/* 입력을 아직 받지 못한 상태가 아니거나, 이미 재계산을 시도했으면 카드를 보여준다
          (재계산 후에도 실패한 해가 있으면 그 사유가 카드에 그대로 나와야 한다) */}
      {(!needsInput || recalculated !== null) && (
        <YearComparisonSection
          subtitle="같은 조건으로 과세연도만 바꿔 다시 계산한 결과입니다. 올해는 확정된 법, 나머지 해는 개정안 기준입니다."
          cards={toCards(current)}
        />
      )}
    </>
  )
}
