/**
 * @컴포넌트: AcquiredRegulatedNotice
 * @설명: '취득 당시' 조정대상지역 판정을 사용자에게 보여준다 — 양도소득세와 매도
 *        실수령액 결과 패널이 공유한다(두 계산기가 같은 엔진을 쓴다).
 *        이 값 하나로 1세대 1주택 비과세의 거주 요건이 갈리므로, 어떤 값을 어디서
 *        얻었는지(등록된 이력 자동 판정인지 사용자가 직접 지정한 것인지)와 그 근거
 *        (지정일·국토교통부 공고)를 함께 밝힌다.
 *        자동으로 판정하지 못한 경우에는 왜 직접 물어야 하는지를 사유별로 설명한다 —
 *        "그냥 모른다"가 아니라 이력이 없는 시점인지, 일부 동만 지정된 구인지 구분해
 *        알려야 사용자가 어디서 확인해야 할지 안다.
 *        날짜·지역은 전부 엔진 결과(등록된 이력)에서 온다 — 이 파일에 날짜가 없다.
 */

import { BadgeCheck, CircleHelp, ExternalLink } from 'lucide-react'
import type { AcquiredRegulatedUnavailableReason } from '@/lib/tax/engine-types'
import type { TransferAcquiredRegulatedInfo } from '@/lib/tax/transfer-types'

/** 자동 판정을 못 한 사유별 안내 — 사용자가 무엇을 해야 하는지까지 적는다 */
const UNAVAILABLE_GUIDES: Record<AcquiredRegulatedUnavailableReason, string> = {
  no_coverage_rule:
    '과거 지정 이력이 아직 등록되지 않아 자동으로 판정할 수 없습니다. 취득 시점의 국토교통부 공고 또는 관할 시·군·구에서 확인한 뒤 직접 선택해 주세요.',
  before_coverage:
    '취득 시점이 등록된 지정 이력이 시작되기 전이라 자동으로 판정할 수 없습니다. 이력이 없는 것이 곧 비규제였다는 뜻은 아니므로 임의로 판단하지 않았습니다 — 취득 당시 공고를 확인한 뒤 직접 선택해 주세요.',
  partial_area:
    '이 시·군·구는 일부 동·읍·면만 지정된 곳이라 구 전체를 기준으로 판정할 수 없습니다. 해당 주택의 주소가 지정 대상에 포함됐는지 취득 당시 공고에서 확인한 뒤 직접 선택해 주세요.',
}

/** YYYY-MM-DD → 'YYYY년 M월' (근거 표시는 월 단위로 충분하다) */
function toYearMonth(date: string): string {
  const [y, m] = date.split('-')
  return `${Number(y)}년 ${Number(m)}월`
}

/**
 * @컴포넌트: AcquiredRegulatedResult
 * @설명: 판정된 값과 근거를 보여줍니다(계산 성공 시).
 * @매개변수: info - 엔진이 담은 판정 결과 / acquiredAt - 취득일(YYYY-MM-DD)
 * @반환값: 판정 안내 박스
 */
export function AcquiredRegulatedResult({ info, acquiredAt }: {
  info: TransferAcquiredRegulatedInfo
  acquiredAt: string
}) {
  const auto = info.source === 'auto'
  return (
    <div className="bg-paper-raised border border-rule rounded-lg p-4">
      <p className="flex items-start gap-2 text-sm font-semibold text-ink mb-1">
        <BadgeCheck size={16} className="text-pen shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          취득 당시({toYearMonth(acquiredAt)} 기준) {info.value ? '조정대상지역이었습니다' : '조정대상지역이 아니었습니다'}
        </span>
      </p>
      <p className="text-xs text-ink-soft leading-relaxed">
        {auto ? (
          info.value && info.designatedFrom ? (
            <>
              등록된 지정 이력({info.designatedFrom} 지정)으로 자동 판정했습니다.
              {info.sourceUrl && (
                <a href={info.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 ml-1 text-pen underline underline-offset-2 hover:text-pen-dark">
                  공고 보기 <ExternalLink size={11} aria-hidden="true" />
                </a>
              )}
              {' '}실제와 다르면 폼에서 직접 선택할 수 있고, 직접 선택한 값이 자동 판정보다 우선합니다.
            </>
          ) : (
            <>
              취득일 기준으로 등록된 지정 이력이 없어 비규제로 판정했습니다. 실제와 다르면 폼에서
              직접 선택할 수 있고, 직접 선택한 값이 자동 판정보다 우선합니다.
            </>
          )
        ) : (
          <>직접 선택하신 값으로 계산했습니다 — 이 값이 자동 판정보다 우선합니다.</>
        )}
      </p>
    </div>
  )
}

/**
 * @컴포넌트: AcquiredRegulatedUnavailable
 * @설명: 자동 판정을 못 해 입력을 요구할 때, 그 이유를 사유별로 설명합니다(계산 실패 시).
 * @매개변수: reason - 엔진이 담은 미판정 사유
 * @반환값: 사유 안내 박스
 */
export function AcquiredRegulatedUnavailable({ reason }: {
  reason: AcquiredRegulatedUnavailableReason
}) {
  return (
    <div className="mt-3 bg-paper-raised border border-rule rounded-lg p-4">
      <p className="flex items-start gap-2 text-sm font-semibold text-ink mb-1">
        <CircleHelp size={16} className="text-ink-soft shrink-0 mt-0.5" aria-hidden="true" />
        <span>왜 직접 선택해야 하나요?</span>
      </p>
      <p className="text-xs text-ink-soft leading-relaxed">{UNAVAILABLE_GUIDES[reason]}</p>
    </div>
  )
}
