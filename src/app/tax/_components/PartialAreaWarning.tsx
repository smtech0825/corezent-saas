/**
 * @컴포넌트: PartialAreaWarning
 * @설명: 규제지역 판정 근거가 '시·군·구 일부만 지정된 이력'일 때의 경고 — 취득세 중과와
 *        양도 당시 다주택 중과는 구 단위로 판정하므로, 해당 주택이 지정 범위 밖이면
 *        실제로는 규제지역이 아니고 세금이 더 낮다. 판정을 바꾸지 않는 대신 그 한계를
 *        판정 결과 옆에서 분명히 밝힌다(모르면 더 낸 세금을 그대로 믿게 된다).
 *        지정 범위(어느 동·읍·면인지)는 관리자가 이력에 적어 둔 메모를 그대로 보여준다 —
 *        지역명·날짜를 이 파일에 넣지 않는다.
 *        취득세·등기비용·양도소득세·매도 실수령액 결과 패널이 공유한다.
 */

import { AlertTriangle } from 'lucide-react'
import type { RegulatedPartialInfo } from '@/lib/tax/engine-types'

export default function PartialAreaWarning({ partial, axisLabel }: {
  /** 부분 지정 판정 정보 — 아니면 이 컴포넌트를 그리지 않는다 */
  partial: RegulatedPartialInfo
  /** 어느 시점 판정인지 — 예: '취득일', '양도일' */
  axisLabel: string
}) {
  return (
    <div className="bg-caution-soft border-2 border-caution/40 rounded-lg p-4" role="alert">
      <p className="flex items-center gap-2 text-sm font-semibold text-caution mb-1">
        <AlertTriangle size={16} aria-hidden="true" />
        이 시점에는 일부 지역만 조정대상지역이었습니다
      </p>
      <p className="text-sm text-ink leading-relaxed">
        {axisLabel} 기준으로 이 시·군·구는 전체가 아니라 일부 동·읍·면만 지정된 상태였습니다.
        이 계산기는 시·군·구 단위로 판정하므로 조정대상지역으로 계산했습니다 —
        <strong className="font-semibold"> 해당 주택이 지정 범위 밖이라면 실제로는 규제지역이 아니고
        세금이 이보다 낮습니다.</strong> 아래 지정 범위와 주소를 대조해 확인하세요.
      </p>
      {partial.note && (
        <p className="text-xs text-ink-soft leading-relaxed mt-2 whitespace-pre-line">
          지정 범위: {partial.note}
        </p>
      )}
    </div>
  )
}
