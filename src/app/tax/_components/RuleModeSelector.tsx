'use client'

/**
 * @컴포넌트: RuleModeSelector
 * @설명: 확정법/개정안(2026 세제개편안) 계산 기준 전환 세그먼트 + 개정안 경고 문구.
 *        취득세 폼의 전환 패턴을 공용화한 것 — 양도소득세·종합부동산세 폼이 사용한다
 *        (폼 300줄 규칙 준수를 위한 분리이기도 하다). 기본값은 폼이 소유하며(확정법),
 *        결과 초기화는 호출부 onChange에서 함께 처리한다.
 *        경고의 시행 연도 문구(2027·2028·2029)는 대표님 승인 문구다(2026-08-15).
 */

import SegmentControl from '@/components/common/SegmentControl'
import type { TaxRuleMode } from '@/lib/tax/types'

export default function RuleModeSelector({ value, onChange, periodNoun }: {
  value: TaxRuleMode
  onChange: (mode: TaxRuleMode) => void
  /** 적용 시점을 가리키는 명사 — 예: '양도일', '과세연도' */
  periodNoun: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <SegmentControl
        label="계산 기준"
        value={value}
        onChange={(v) => onChange(v === 'proposed' ? 'proposed' : 'confirmed')}
        options={[
          { value: 'confirmed', label: '확정된 법 기준' },
          { value: 'proposed', label: '개정안 포함' },
        ]}
      />
      {value === 'proposed' && (
        <p className="text-xs text-caution font-medium max-w-72 leading-relaxed">
          개정안은 아직 국회 통과 전이라 확정이 아닙니다. 항목별 시행 시점이
          2027·2028·2029년으로 나뉘어 {periodNoun}에 따라 적용이 달라집니다.
          결과에 경고가 함께 표시됩니다.
        </p>
      )}
    </div>
  )
}
