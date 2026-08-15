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

/**
 * @컴포넌트: TransferComparisonCards
 * @설명: 양도소득세 연도별 비교를 카드로 그립니다 — 엔진 결과를 카드 데이터로 옮기고,
 *        이 비교가 무엇을 그대로 두고 계산했는지(한계)를 함께 알립니다.
 * @매개변수: comparison - 서버 액션이 반환한 연도별 비교 묶음
 * @반환값: 연도별 비교 섹션
 */
export default function TransferComparisonCards({ comparison }: {
  comparison: YearComparison<TransferSuccess>
}) {
  // 이 비교의 한계 — 차이를 전부 '개정안 때문'으로 읽지 않도록 근거를 밝힌다
  const notes: string[] = [
    '취득일은 입력하신 그대로 두고 양도 연도만 바꿉니다 — 뒤 연도일수록 보유기간이 길어지므로, 차이에는 법 개정뿐 아니라 보유기간이 늘어난 영향도 함께 들어 있습니다.',
  ]
  // 위 결과와 카드가 어긋날 수 있는 두 경우를 구분해 알린다 — 같은 숫자가 아닌 이유를 모르면
  // 사용자가 어느 쪽을 자기 세금으로 봐야 할지 알 수 없다
  const sameYearCard = comparison.entries.find((e) => e.year === comparison.inputYear)
  if (!sameYearCard) {
    notes.push(
      `위에서 계산한 ${comparison.inputYear}년은 이 비교에 없습니다 — 비교는 올해와 개편안 시행 연도만 보여드립니다.`,
    )
  } else if (sameYearCard.ruleMode !== comparison.inputRuleMode) {
    notes.push(
      `${comparison.inputYear}년 카드는 ${sameYearCard.ruleMode === 'confirmed' ? '확정된 법' : '개정안'} 기준이라 위 결과와 금액이 다를 수 있습니다.`,
    )
  }

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
      subtitle="입력하신 내용에서 양도 연도만 바꿔 다시 계산한 결과입니다. 올해는 확정된 법, 나머지 해는 개정안 기준입니다."
      notes={notes}
      cards={cards}
    />
  )
}
