'use client'

/**
 * @컴포넌트: BrokerageResultPanel
 * @설명: 중개수수료 상한 계산 결과 표시 — 이번 화면의 핵심은 큰 숫자가 '내야 할 금액'이
 *        아니라 '법정 상한액'임을 분명히 하는 것이다. 협의로 정한다는 안내를 하단 작은
 *        글씨가 아니라 결과 숫자 바로 옆(같은 카드 안 강조 박스)에 둔다.
 *        부가가치세는 별도 항목으로 표시하고 어떤 경우에 붙는지 안내한다.
 *        근거(법령·조문·시행일·원문 링크)는 취득세·인지세와 같은 형식으로 표시한다.
 */

import { AlertTriangle, ExternalLink, Handshake, ScrollText } from 'lucide-react'
import type { BrokerageResult } from '@/lib/tax/engine-types'

/** 원화 표기 */
function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export default function BrokerageResultPanel({ result }: { result: BrokerageResult }) {
  // ── 계산 불가 — 0원 대신 사유를 명확히 안내 (취득세·인지세와 동일 문구 체계) ─
  if (!result.ok) {
    return (
      <div className="bg-danger-soft border border-danger/30 rounded-lg p-6" role="alert">
        <p className="flex items-center gap-2 font-serif font-bold text-danger mb-2">
          <AlertTriangle size={18} />
          계산할 수 없습니다
        </p>
        <p className="text-sm text-ink leading-relaxed">{result.message}</p>
        <p className="text-xs text-ink-soft mt-3">
          상한이 0원이라는 뜻이 아닙니다. 계산에 필요한 근거가 준비되지 않아 결과를 제공하지 않는 것입니다.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 상한액 — '상한'임을 숫자와 같은 비중으로 안내 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6">
        <h2 className="font-serif font-bold text-ink mb-4">계산 결과</h2>
        <div className="flex items-baseline justify-between">
          <span className="font-serif font-bold text-ink">중개보수 상한액</span>
          <span className="font-mono text-xl font-bold text-pen">{won(result.capAmount)}</span>
        </div>

        {/* 협의 안내 — 결과 숫자 바로 옆에 두는 것이 이 화면의 요구사항 */}
        <div className="mt-4 bg-info-soft border border-info/30 rounded-md p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-info mb-1">
            <Handshake size={16} />
            이 금액은 내야 할 금액이 아니라 법정 상한입니다
          </p>
          <p className="text-sm text-ink leading-relaxed">
            실제 중개보수는 이 상한을 넘지 않는 범위에서 의뢰인과 개업공인중개사가
            협의하여 정합니다. 상한보다 적게 정할 수 있습니다.
          </p>
        </div>

        {/* 계산 상세 — 적용 요율·한도액·환산 내역 (전부 룰에서 온 값) */}
        <dl className="mt-4 pt-4 border-t border-rule space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">적용된 상한 요율</dt>
            <dd className="font-mono text-ink">{result.appliedRatePercent}%</dd>
          </div>
          {result.leaseConversion && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">
                환산 거래금액
                <span className="block text-xs text-ink-faint">
                  보증금 + 월세 × {result.leaseConversion.multiplierUsed}
                  {result.leaseConversion.usedLowDeposit ? ' (소액 구간 배수 적용)' : ''}
                </span>
              </dt>
              <dd className="font-mono text-ink">{won(result.dealPrice)}</dd>
            </div>
          )}
          {result.limitAmount !== null && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">이 구간의 한도액</dt>
              <dd className="font-mono text-ink">
                {won(result.limitAmount)}
                {result.limitApplied && <span className="ml-1.5 text-xs font-semibold text-caution">한도 적용됨</span>}
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">
              부가가치세 (별도, 상한액 기준 {result.vatRatePercent}%)
            </dt>
            <dd className="font-mono text-ink">{won(result.vatAmount)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-soft leading-relaxed">
          요율표 금액에 부가가치세가 포함되는지는 법령에 명시가 없어 실제 거래 시 확인이
          필요합니다. 부가가치세 적용 방식은 개업공인중개사의 과세 유형
          (일반과세·간이과세)에 따라 다릅니다. 계약 전에 확인하세요.
        </p>

        <p className="mt-4 pt-4 border-t border-rule text-xs text-ink-soft leading-relaxed">
          상한 요율과 한도액을 정하는 시·도 조례는 중개사무소 소재지 기준으로 적용되며,
          지역·시기에 따라 다를 수 있습니다. 이 결과는 등록된 룰 기준이며, 실제 적용
          요율은 해당 시·도 조례와 중개대상물 확인·설명서에서 확인할 수 있습니다.
        </p>
      </div>

      {/* 근거 영역 — 취득세·인지세와 같은 형식 */}
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
