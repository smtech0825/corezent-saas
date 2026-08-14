'use client'

/**
 * @컴포넌트: RegistrationResultPanel
 * @설명: 등기비용 계산 결과 표시 — 이 계산기의 핵심은 "무엇이 얼마씩 나가는지"이므로
 *        항목별 금액 표가 중심이다. 포함되지 않은 항목은 0원이 아니라 "입력하면
 *        포함됩니다"로 표시하고, 일부가 빠졌으면 실제 지출이 총액보다 클 수 있다고
 *        명시한다. 등기신청 수수료는 적용된 방법과 다른 방법의 금액을 함께 보여준다.
 *        근거 목록은 여러 세목(취득세·인지세·등기비용·공통)의 룰이 섞이므로
 *        룰 키 접두사로 세목 배지를 붙여 구분한다(기존 엔진 무수정 방식).
 */

import { AlertTriangle, ExternalLink, ScrollText } from 'lucide-react'
import { TAX_TYPE_LABELS } from '@/lib/tax/labels'
import type { RegistrationResult } from '@/lib/tax/registration-types'

/** 원화 표기 */
function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/**
 * 룰 키 접두사 → 세목 라벨. 여러 세목의 룰이 한 근거 목록에 섞이므로 사용자가
 * 어느 세목의 조문인지 구분할 수 있게 한다. 접두사가 세목이 아닌 키(region.metro_scope
 * 등 공통 룰)는 '공통'으로 표시한다.
 */
function taxTypeLabelOf(ruleKey: string): string {
  const prefix = ruleKey.split('.')[0]
  return (TAX_TYPE_LABELS as Record<string, string>)[prefix] ?? '공통'
}

/** 항목 한 행 — 금액, '입력하면 포함됩니다'(미포함), '면제'(대상 아님) 중 하나를 표시 */
function ItemRow({ label, note, amount, notIncluded, exempt }: {
  label: string; note?: string; amount?: number; notIncluded?: boolean; exempt?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-rule last:border-b-0">
      <dt className="text-sm text-ink-soft">
        {label}
        {note && <span className="block text-xs text-ink-faint mt-0.5">{note}</span>}
      </dt>
      <dd className={`font-mono text-sm ${notIncluded ? 'text-ink-faint' : exempt ? 'text-ok' : 'text-ink'}`}>
        {exempt ? '면제 — 매입 대상 아님' : notIncluded ? '입력하면 포함됩니다' : won(amount ?? 0)}
      </dd>
    </div>
  )
}

export default function RegistrationResultPanel({ result }: { result: RegistrationResult }) {
  // ── 계산 불가 — 0원 대신 사유를 명확히 안내 (다른 계산기와 동일 문구 체계) ──
  if (!result.ok) {
    return (
      <div className="bg-danger-soft border border-danger/30 rounded-lg p-6" role="alert">
        <p className="flex items-center gap-2 font-serif font-bold text-danger mb-2">
          <AlertTriangle size={18} />
          계산할 수 없습니다
        </p>
        <p className="text-sm text-ink leading-relaxed">{result.message}</p>
        <p className="text-xs text-ink-soft mt-3">
          비용이 0원이라는 뜻이 아닙니다. 계산에 필요한 근거 또는 입력이 준비되지 않아 결과를 제공하지 않는 것입니다.
        </p>
      </div>
    )
  }

  const b = result.breakdown

  return (
    <div className="space-y-4">
      {/* 판정하지 못한 조건 — 눈에 띄게 최상단 경고 (다른 계산기와 동일 체계) */}
      {result.unresolvedFields.length > 0 && (
        <div className="bg-caution-soft border-2 border-caution/40 rounded-lg p-4" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-caution mb-1">
            <AlertTriangle size={16} />
            판정하지 못한 조건이 있습니다
          </p>
          <p className="text-sm text-ink leading-relaxed">
            {result.unresolvedFields.join(', ')} — 해당 값을 입력하면 결과가 달라질 수 있습니다.
            0이나 &lsquo;아니오&rsquo;로 간주하지 않았습니다.
          </p>
        </div>
      )}

      {/* 항목별 표 — 이 계산기의 핵심 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6">
        <h2 className="font-serif font-bold text-ink mb-4">항목별 등기비용</h2>
        <dl>
          <ItemRow label="취득세" amount={b.acquisitionTax} />
          <ItemRow label="지방교육세" amount={b.localEducationTax} />
          <ItemRow label="농어촌특별세" amount={b.ruralSpecialTax} />
          <ItemRow label="인지세" note={result.stampExempt ? '비과세 — 아래 사유 참고' : undefined} amount={b.stampTax} />
          <ItemRow label={`등기신청 수수료 (${result.feeMethodLabel})`} amount={b.registrationFee} />
          <ItemRow label="국민주택채권 즉시매도 손실액"
            note={result.bond.status === 'included'
              ? `매입 의무액 ${won(result.bond.purchaseAmount)} (매입률 ${result.bond.ratePercent}%) × 손실률 ${result.bond.lossPercent}%`
              : undefined}
            amount={b.bondLoss.status === 'included' ? b.bondLoss.amount : undefined}
            notIncluded={b.bondLoss.status === 'not_included'}
            exempt={b.bondLoss.status === 'exempt'} />
          <ItemRow label="법무사 보수"
            amount={b.judicialFee.status === 'included' ? b.judicialFee.amount : undefined}
            notIncluded={b.judicialFee.status === 'not_included'} />
        </dl>
        <div className="flex items-baseline justify-between gap-4 pt-3 mt-1">
          <span className="font-serif font-bold text-ink">등기비용 합계{result.someExcluded ? ' (포함된 항목 기준)' : ''}</span>
          <span className="font-mono text-xl font-bold text-pen">{won(b.total)}</span>
        </div>
        {result.someExcluded && (
          <p className="mt-3 text-sm text-caution bg-caution-soft border border-caution/30 rounded-md p-3 leading-relaxed">
            일부 항목이 계산에 포함되지 않았습니다 — 실제 지출은 이 합계보다 클 수 있습니다.
            빠진 항목은 위 표에서 &lsquo;입력하면 포함됩니다&rsquo;로 표시돼 있습니다.
          </p>
        )}

        {/* 판정 배지 */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
            {result.isRegulatedArea ? '조정대상지역 (취득일 기준)' : '비규제지역 (취득일 기준)'}
          </span>
          {result.stampExempt && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-info-soft text-info">
              인지세 비과세
            </span>
          )}
        </div>
      </div>

      {/* 안내 내역 — 수수료 다른 방법·인지세 비과세 사유·빠진 항목 사유 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6 space-y-4">
        <h2 className="font-serif font-bold text-ink">참고 사항</h2>
        {result.feeOtherMethods.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-ink mb-1">등기신청 수수료 — 신청 방법에 따라 다릅니다</p>
            <p className="text-sm text-ink-soft leading-relaxed">
              이 계산은 {result.feeMethodLabel} 기준입니다. 다른 방법:{' '}
              {result.feeOtherMethods.map((m) => `${m.methodLabel} ${won(m.amount)}`).join(' · ')}
            </p>
          </div>
        )}
        {result.stampExempt && result.stampExemptReason && (
          <div>
            <p className="text-sm font-semibold text-ink mb-1">인지세 비과세</p>
            <p className="text-sm text-ink-soft leading-relaxed">{result.stampExemptReason}</p>
          </div>
        )}
        {result.bond.status === 'not_included' && (
          <div>
            <p className="text-sm font-semibold text-ink mb-1">국민주택채권 — 포함되지 않음</p>
            <p className="text-sm text-ink-soft leading-relaxed">{result.bond.reason}</p>
          </div>
        )}
        {result.bond.status === 'exempt' && (
          <div>
            <p className="text-sm font-semibold text-ink mb-1">국민주택채권 — 매입 면제</p>
            <p className="text-sm text-ink-soft leading-relaxed">
              {result.bond.reason} 0원이 아니라 매입 의무 자체가 없다는 뜻입니다 — 손실률을
              입력해도 이 항목은 계산에 들어가지 않습니다.
            </p>
          </div>
        )}
        {b.judicialFee.status === 'not_included' && (
          <div>
            <p className="text-sm font-semibold text-ink mb-1">법무사 보수 — 포함되지 않음</p>
            <p className="text-sm text-ink-soft leading-relaxed">{b.judicialFee.reason}</p>
          </div>
        )}
      </div>

      {/* 근거 영역 — 여러 세목의 룰이 섞이므로 세목 배지로 구분 */}
      <div className="bg-paper-raised border-2 border-pen/25 rounded-lg p-6">
        <h2 className="flex items-center gap-2 font-serif font-bold text-ink mb-1">
          <ScrollText size={18} className="text-pen" />
          적용된 법령 근거
        </h2>
        <p className="text-xs text-ink-soft mb-4">
          아래 근거가 이 계산에 실제로 적용되었습니다(취득세·인지세 계산에 쓰인 룰 포함).
          숫자보다 이 근거를 먼저 확인하세요.
        </p>
        <ul className="space-y-3">
          {result.appliedRules.map((rule) => (
            <li key={rule.id} className="border border-rule rounded-md p-4 bg-paper">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
                  {taxTypeLabelOf(rule.ruleKey)}
                </span>
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
              <a href={rule.lawUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-pen underline underline-offset-2 hover:text-pen-dark">
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
