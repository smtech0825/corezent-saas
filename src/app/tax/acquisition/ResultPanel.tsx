'use client'

/**
 * @컴포넌트: ResultPanel
 * @설명: 취득세 계산 결과 표시 — 세액 3항목을 각각 표시하고, 그 바로 아래에
 *        적용 법령 근거(법령명·조문·시행일·원문 링크·확정/개정안)를 크게 배치한다.
 *        룰 미등록 등 계산 불가일 때는 0원을 보여주지 않고 사유를 그대로 안내한다.
 *        개정안 포함 모드에서는 눈에 띄는 경고 배지를 최상단에 띄운다.
 */

import { AlertTriangle, CircleHelp, ExternalLink, ScrollText } from 'lucide-react'
import type { AcquisitionCause, AcquisitionResult } from '@/lib/tax/engine-types'
import CalcFailureNotice from '../_components/CalcFailureNotice'
import PartialAreaWarning from '../_components/PartialAreaWarning'

interface Props {
  result: AcquisitionResult
  inputCause: AcquisitionCause   // 입력한 취득 원인 — 간주/전환 안내문에 사용
}

/** 원화 표기 */
function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 판정하지 못한 조건 필드의 한국어 라벨 — 모르는 필드는 원문 그대로 표시 */
const UNRESOLVED_FIELD_LABELS: Record<string, string> = {
  area_sqm: '전용면적',
  area_over_85: '전용면적',
  official_price: '공시가격(시가표준액)',
  is_metro: '수도권 여부',
  market_value: '시가인정액',
  price: '취득가액',
}

export default function ResultPanel({ result, inputCause }: Props) {
  // ── 계산 불가 — 0원 대신 사유를 명확히 안내 ──────────────────────────────
  if (!result.ok) {
    // 실패 원인(입력 부족·룰 미등록·근거 없음 등)별 안내는 공용 컴포넌트가 구분한다
    return <CalcFailureNotice failure={result} amountNoun="세액" />
  }

  const items = [
    { label: '취득세', amount: result.breakdown.acquisitionTax },
    { label: '지방교육세', amount: result.breakdown.localEducationTax },
    { label: '농어촌특별세', amount: result.breakdown.ruralSpecialTax },
  ]

  return (
    <div className="space-y-4">
      {/* 개정안 모드 경고 배지 — 계산 당시 모드(result.ruleMode) 기준. 토글을 나중에
          바꿔도 이 결과가 어떤 모드로 계산됐는지가 표시되어야 한다 */}
      {result.ruleMode === 'proposed' && (
        <div className="bg-caution-soft border-2 border-caution rounded-lg p-4" role="alert">
          <p className="flex items-center gap-2 font-serif font-black text-caution text-base">
            <AlertTriangle size={20} />
            개정안 포함 계산 — 확정된 세액이 아닙니다
          </p>
          <p className="text-sm text-ink mt-1.5 leading-relaxed">
            이 결과에는 국회를 통과하지 않은 개정안이 반영될 수 있습니다. 입법예고·국회 심의
            과정에서 내용이 바뀌거나 무산될 수 있으므로, 실제 세액은 반드시 확정된 법 기준으로
            확인하세요.
            {!result.containsProposedRule && (
              <span className="block mt-1 text-ink-soft">
                (이번 계산에는 개정안 룰이 실제로 적용되지 않아 확정법 기준과 같습니다.)
              </span>
            )}
          </p>
        </div>
      )}

      {/* 판정 근거가 일부 지역만 지정된 이력이면 그 한계를 밝힌다 —
          구 단위 판정이라 지정 범위 밖 주택은 실제 세금이 더 낮다 */}
      {result.regulatedPartial && (
        <PartialAreaWarning partial={result.regulatedPartial} axisLabel="취득일" />
      )}

      {/* 세액 분해 — 3항목 각각 + 합계 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6">
        <h2 className="font-serif font-bold text-ink mb-4">계산 결과</h2>
        <dl className="divide-y divide-rule">
          {items.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between py-2.5">
              <dt className="text-sm text-ink-soft">{item.label}</dt>
              <dd className="font-mono text-sm text-ink">{won(item.amount)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between pt-3">
            <dt className="font-serif font-bold text-ink">합계</dt>
            <dd className="font-mono text-xl font-bold text-pen">{won(result.breakdown.total)}</dd>
          </div>
        </dl>

        {/* 판정 요약 */}
        <div className="mt-4 pt-4 border-t border-rule flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-paper-shade text-ink-soft">
            과세표준 {won(result.taxBase)}
          </span>
          <span className="px-2 py-1 rounded bg-paper-shade text-ink-soft">
            {result.isRegulatedArea ? '조정대상지역' : '비규제지역'} (취득일 기준)
          </span>
          <span className="px-2 py-1 rounded bg-paper-shade text-ink-soft">
            {result.causeApplied === 'gift' ? '무상취득(증여)으로 계산' : '유상취득으로 계산'}
          </span>
          {result.giftTaxBaseUsed && (
            <span className="px-2 py-1 rounded bg-paper-shade text-ink-soft">
              과세표준 기준: {result.giftTaxBaseUsed === 'market_value' ? '시가인정액' : '공시가격(시가표준액)'}
            </span>
          )}
        </div>
        {result.deemedGift && (
          <p className="mt-2 text-xs text-caution leading-relaxed">
            지급한 대가와 시가인정액의 차이가 룰에 정의된 기준을 넘어 무상취득으로 간주해 계산했습니다.
          </p>
        )}
        {inputCause === 'gift' && result.causeApplied === 'onerous' && (
          <p className="mt-2 text-xs text-ink-soft leading-relaxed">
            지급한 대가가 기준 범위에서 인정되어 유상취득으로 계산했습니다.
          </p>
        )}
      </div>

      {/* 판정하지 못한 조건 — 근거 표시와 같은 비중으로 눈에 띄게. 조용히 숨기지 않는다 */}
      {result.unresolvedFields.length > 0 && (
        <div className="bg-caution-soft border-2 border-caution/60 rounded-lg p-6" role="alert">
          <h2 className="flex items-center gap-2 font-serif font-bold text-caution mb-1">
            <CircleHelp size={18} />
            판정하지 못한 조건이 있습니다
          </h2>
          <p className="text-sm text-ink leading-relaxed">
            다음 조건은 판정에 필요한 값이 없어 건너뛰었고, 그 조건이 붙은 세율 행은 적용 후보에서
            제외되었습니다:{' '}
            <b>{result.unresolvedFields.map((f) => UNRESOLVED_FIELD_LABELS[f] ?? f).join(', ')}</b>.
          </p>
          <p className="text-xs text-ink-soft mt-2 leading-relaxed">
            해당 값을 입력하고 다시 계산하면(수도권 여부는 수도권 범위 룰 등록이 필요합니다) 결과가
            달라질 수 있습니다. 이 금액을 최종 세액으로 단정하지 마세요.
          </p>
        </div>
      )}

      {/* 근거 영역 — 결과 바로 아래 크게. 이 계산기의 존재 이유 */}
      <div className="bg-paper-raised border-2 border-pen/25 rounded-lg p-6">
        <h2 className="flex items-center gap-2 font-serif font-bold text-ink mb-1">
          <ScrollText size={18} className="text-pen" />
          적용된 법령 근거
        </h2>
        <p className="text-xs text-ink-soft mb-4">
          아래 근거가 이 계산에 실제로 적용되었습니다. 숫자보다 이 근거를 먼저 확인하세요.
        </p>
        <ul className="space-y-3">
          {result.appliedRules.map((rule) => (
            <li key={rule.id} className="border border-rule rounded-md p-4 bg-paper">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm text-ink">
                  {rule.lawName} {rule.lawArticle}
                </span>
                {rule.status === 'proposed' ? (
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-caution-soft text-caution">
                    개정안 (미확정)
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-ok-soft text-ok">
                    확정
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft mt-1.5">
                시행 {rule.effectiveFrom}
                {rule.effectiveTo ? ` ~ ${rule.effectiveTo}` : ' ~ 현재'}
                <span className="mx-2 text-rule">|</span>
                <span className="font-mono">{rule.ruleKey}</span>
              </p>
              <a
                href={rule.lawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-pen underline underline-offset-2 hover:text-pen-dark"
              >
                법제처 원문 보기
                <ExternalLink size={12} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
