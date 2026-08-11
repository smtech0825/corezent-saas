'use client'

/**
 * @컴포넌트: ResultPanel
 * @설명: 취득세 계산 결과 표시 — 세액 3항목을 각각 표시하고, 그 바로 아래에
 *        적용 법령 근거(법령명·조문·시행일·원문 링크·확정/개정안)를 크게 배치한다.
 *        룰 미등록 등 계산 불가일 때는 0원을 보여주지 않고 사유를 그대로 안내한다.
 *        개정안 포함 모드에서는 눈에 띄는 경고 배지를 최상단에 띄운다.
 */

import { AlertTriangle, ExternalLink, ScrollText } from 'lucide-react'
import type { AcquisitionCause, AcquisitionResult } from '@/lib/tax/engine-types'

interface Props {
  result: AcquisitionResult
  inputCause: AcquisitionCause   // 입력한 취득 원인 — 간주/전환 안내문에 사용
}

/** 원화 표기 */
function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export default function ResultPanel({ result, inputCause }: Props) {
  // ── 계산 불가 — 0원 대신 사유를 명확히 안내 ──────────────────────────────
  if (!result.ok) {
    return (
      <div className="bg-danger-soft border border-danger/30 rounded-lg p-6" role="alert">
        <p className="flex items-center gap-2 font-serif font-bold text-danger mb-2">
          <AlertTriangle size={18} />
          계산할 수 없습니다
        </p>
        <p className="text-sm text-ink leading-relaxed">{result.message}</p>
        <p className="text-xs text-ink-soft mt-3">
          세액이 0원이라는 뜻이 아닙니다. 계산에 필요한 근거가 준비되지 않아 결과를 제공하지 않는 것입니다.
        </p>
      </div>
    )
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
