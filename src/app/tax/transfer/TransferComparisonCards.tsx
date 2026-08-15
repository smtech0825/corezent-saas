/**
 * @컴포넌트: TransferComparisonCards
 * @설명: 양도소득세 연도별 비교 어댑터 — 서버 액션이 준 비교 묶음
 *        (YearComparison<TransferSuccess>)을 공용 카드 데이터로 정규화해
 *        YearComparisonSection에 넘긴다. '왜 달라졌는지 한 줄'의 수치
 *        (공제율·기본공제액)는 전부 엔진 결과(=등록된 룰)에서 온다 —
 *        이 파일에 세율·공제율·연도 숫자를 넣지 않는다.
 */

import YearComparisonSection, { type YearCardData } from '../_components/YearComparisonSection'
import type { YearComparison } from '@/lib/tax/year-comparison'
import type { TransferSuccess } from '@/lib/tax/transfer-types'

/** 그 해의 결과가 왜 이 값인지 한 줄 — 비과세면 사유, 과세면 공제·중과 요약 */
function reasonLine(r: TransferSuccess): string {
  if (r.exempt) return r.exemptReason ?? '비과세'
  const parts: string[] = [
    r.ltsdTable === 'none'
      ? '장기보유특별공제 없음'
      : `장기보유특별공제 ${r.ltsdPercentTotal}%${r.ltsdCapApplied ? '(한도 적용)' : ''}`,
    `기본공제 ${r.breakdown.basicDeduction.toLocaleString('ko-KR')}원`,
  ]
  if (r.heavyApplied) parts.push('다주택 중과')
  return parts.join(' · ')
}

export default function TransferComparisonCards({ comparison }: {
  comparison: YearComparison<TransferSuccess>
}) {
  const cards: YearCardData[] = comparison.entries.map((e) =>
    e.result.ok
      ? {
          year: e.year,
          ruleMode: e.ruleMode,
          isBaseYear: e.isBaseYear,
          ok: true,
          totalTax: e.result.breakdown.totalTax,
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

  return (
    <YearComparisonSection
      subtitle="같은 조건으로 양도 연도만 바꿔 다시 계산한 결과입니다. 올해는 확정된 법, 나머지 해는 개정안 기준입니다."
      cards={cards}
    />
  )
}
