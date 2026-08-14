/**
 * @컴포넌트: CalcFailureNotice
 * @설명: 계산 실패 공용 안내 — 실패 원인(코드)별로 제목과 대처 안내를 구분해 보여준다.
 *        기존에는 어떤 이유든 같은 문구가 떠서 사용자가 무엇을 해야 하는지 알 수 없었다:
 *        입력이 부족한 경우(다시 입력), 그 시점의 룰이 없는 경우(등록 대기),
 *        조건에 맞는 근거 행이 없는 경우 등을 나눠 안내한다.
 *        엔진 message(한국어 상세 사유)는 그대로 본문에 표시하고, 이 컴포넌트는
 *        제목·대처 힌트만 원인별로 바꾼다 — 계산 로직에는 관여하지 않는다.
 *        계산기 8종 결과 패널이 공용으로 쓴다(문구 수정도 여기 한 곳만).
 */

import { AlertTriangle } from 'lucide-react'
import type { TaxEngineFailure } from '@/lib/tax/engine-types'

/** 실패 코드별 제목·대처 안내. {noun}은 amountNoun(세액·비용 등)으로 치환된다 */
const FAILURE_GUIDES: Record<TaxEngineFailure['code'], { title: string; hint: string }> = {
  INVALID_INPUT: {
    title: '입력을 확인해 주세요',
    hint: '입력이 부족하거나 형식이 맞지 않아 계산하지 못했습니다. 위 사유에 따라 입력을 고친 뒤 다시 계산해 주세요.',
  },
  RULE_NOT_REGISTERED: {
    title: '이 시점의 계산 근거가 아직 등록되지 않았습니다',
    hint: '입력한 기준일 시점에 유효한 법령 근거(룰)가 등록되어 있지 않습니다. 근거가 등록될 때까지 이 계산은 제공되지 않습니다 — {noun}이 0원이라는 뜻이 아닙니다. 기준일(날짜·연도)을 바꾸면 계산될 수도 있습니다.',
  },
  NO_MATCHING_RATE_ROW: {
    title: '입력 조건에 맞는 계산 근거가 없습니다',
    hint: '법령 근거(룰)는 등록되어 있으나 입력하신 조건에 해당하는 항목이 없습니다. 입력을 바꾸거나, 해당 조건의 근거가 등록될 때까지 기다려 주세요 — {noun}이 0원이라는 뜻이 아닙니다.',
  },
  AMBIGUOUS_RATE_ROW: {
    title: '계산 근거가 하나로 정해지지 않습니다',
    hint: '등록된 근거끼리 겹쳐 어느 것을 적용할지 정할 수 없습니다. 운영자가 정리할 때까지 이 조건의 계산은 제공되지 않습니다 — {noun}이 0원이라는 뜻이 아닙니다.',
  },
  RULE_CONFLICT: {
    title: '계산 근거가 겹쳐 있습니다',
    hint: '같은 근거가 중복 등록되어 계산을 중단했습니다. 운영자가 정리할 때까지 이 계산은 제공되지 않습니다 — {noun}이 0원이라는 뜻이 아닙니다.',
  },
  RULE_VALUE_INVALID: {
    title: '계산 근거에 문제가 있습니다',
    hint: '등록된 근거의 내용에 오류가 있어 계산을 중단했습니다. 잘못된 근거로 계산하지 않기 위한 조치입니다 — {noun}이 0원이라는 뜻이 아닙니다.',
  },
  DB_ERROR: {
    title: '일시적인 오류가 발생했습니다',
    hint: '근거 조회에 일시적으로 실패했습니다. 잠시 후 다시 계산해 주세요.',
  },
}

export default function CalcFailureNotice({ failure, amountNoun }: {
  /** 엔진 실패 결과 — message는 화면에 그대로 표시할 한국어 사유 */
  failure: TaxEngineFailure
  /** 결과 금액의 이름 — '세액'·'비용'·'상한'·'실수령액' 등 ("0원이 아니다" 문구에 사용) */
  amountNoun: string
}) {
  const guide = FAILURE_GUIDES[failure.code]
  return (
    <div className="bg-danger-soft border border-danger/30 rounded-lg p-6" role="alert">
      <p className="flex items-center gap-2 font-serif font-bold text-danger mb-2">
        <AlertTriangle size={18} />
        {guide.title}
      </p>
      <p className="text-sm text-ink leading-relaxed">{failure.message}</p>
      <p className="text-xs text-ink-soft mt-3 leading-relaxed">
        {guide.hint.replace('{noun}', amountNoun)}
      </p>
    </div>
  )
}
