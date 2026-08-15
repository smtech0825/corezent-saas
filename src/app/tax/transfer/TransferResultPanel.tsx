'use client'

/**
 * @컴포넌트: TransferResultPanel
 * @설명: 양도소득세 계산 결과 표시 — 낼 세금(양도소득세·지방소득세·합계), 손에 쥐는 돈,
 *        계산 과정 단계별 금액, 그리고 이 계산기에서 가장 오해가 많은 판정들
 *        (어느 장기보유특별공제 표를 왜 썼는지·중과·경과조치·비교과세·고가주택 안분)을
 *        사유와 함께 그대로 보여준다. 판정하지 못한 조건은 눈에 띄게 경고한다.
 *        비과세면 0원만 보여주지 않고 왜 세금이 없는지를 함께 표시한다.
 */

import { AlertTriangle, BadgeCheck, ExternalLink, ScrollText } from 'lucide-react'
import { TRANSFER_RULE_KEYS } from '@/lib/tax/transfer-rules'
import type { TransferResult } from '@/lib/tax/transfer-types'
import CalcFailureNotice from '../_components/CalcFailureNotice'
import { AcquiredRegulatedResult, AcquiredRegulatedUnavailable } from '../_components/AcquiredRegulatedNotice'
import PartialAreaWarning from '../_components/PartialAreaWarning'

/** 원화 표기 */
function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 세액 산출 경로 라벨 — 실제 적용된 경로를 그대로 표시한다(중과를 '기본 세율'로 오표시 금지) */
const RATE_PATH_LABELS: Record<string, string> = {
  base: '기본 세율',
  heavy: '중과 세율(기본세율+가산)',
  short_term: '단기 세율',
}

/** 미확정 조건 필드명 → 한국어 라벨 */
const UNRESOLVED_LABELS: Record<string, string> = {
  residence_years: '거주기간',
  grace_contract: '중과 경과조치(계약 체결일·계약금 수령)',
  is_metro: '수도권 여부',
  sido: '시·도',
  sigungu: '시·군·구',
}

export default function TransferResultPanel({ result, acquiredAt }: {
  result: TransferResult
  /** 제출 시점의 취득일(YYYY-MM-DD) — 취득 당시 조정대상지역 판정 표시에 쓴다 */
  acquiredAt: string
}) {
  // ── 계산 불가 — 0원 대신 사유를 명확히 안내 (다른 계산기와 동일 문구 체계) ──
  if (!result.ok) {
    // 실패 원인(입력 부족·룰 미등록·근거 없음 등)별 안내는 공용 컴포넌트가 구분한다.
    // 취득 당시 조정대상지역을 자동 판정하지 못한 경우에는 왜 직접 선택해야 하는지도 밝힌다.
    return (
      <>
        <CalcFailureNotice failure={result} amountNoun="세액" />
        {result.acquiredRegulatedUnavailable && (
          <AcquiredRegulatedUnavailable reason={result.acquiredRegulatedUnavailable} />
        )}
      </>
    )
  }

  const b = result.breakdown

  return (
    <div className="space-y-4">
      {/* 판정하지 못한 조건 — 눈에 띄게 최상단 경고 */}
      {result.unresolvedFields.length > 0 && (
        <div className="bg-caution-soft border-2 border-caution/40 rounded-lg p-4" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-caution mb-1">
            <AlertTriangle size={16} />
            판정하지 못한 조건이 있습니다
          </p>
          <p className="text-sm text-ink leading-relaxed">
            {result.unresolvedFields.map((f) => UNRESOLVED_LABELS[f] ?? f).join(', ')} — 해당 값을
            입력하면 결과가 달라질 수 있습니다. 0이나 &lsquo;아니오&rsquo;로 간주하지 않았습니다.
          </p>
        </div>
      )}

      {/* 양도 당시 판정 근거가 일부 지역만 지정된 이력이면 그 한계를 밝힌다 —
          구 단위 판정이라 지정 범위 밖 주택은 실제 세금이 더 낮다 */}
      {result.regulatedAtTransferPartial && (
        <PartialAreaWarning partial={result.regulatedAtTransferPartial} axisLabel="양도일" />
      )}

      {/* 취득 당시 조정대상지역 판정 — 비과세 거주 요건이 이 값으로 갈리므로
          어떤 값을 어디서 얻었는지(자동/직접)와 근거를 밝힌다 */}
      {result.acquiredRegulated && (
        <AcquiredRegulatedResult info={result.acquiredRegulated} acquiredAt={acquiredAt} />
      )}

      {/* 신고 시점 완화 특례(개정안) — 중과 적용 + 양도일 직후 연도부터 완화 룰 시행인 경우.
          날짜·가산율은 룰에서 읽으며, 읽지 못하면 수치 없는 일반 안내로 표시한다 */}
      {result.filingRelief && (
        <div className="bg-info-soft border-2 border-info/40 rounded-lg p-4" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-info mb-1">
            <AlertTriangle size={16} />
            신고 시점에 따라 중과 세율이 완화될 수 있습니다 (국회 통과 전 개정안)
          </p>
          <p className="text-sm text-ink leading-relaxed">
            {result.filingRelief.effectiveFrom && result.filingRelief.reliefPoints !== null
              ? `이 계산에는 다주택 중과 가산 +${result.filingRelief.currentPoints}%p가 적용됐지만, 개정안의 특례규정에 따라 ${result.filingRelief.effectiveFrom} 이후에 예정·확정신고하면 완화된 가산 +${result.filingRelief.reliefPoints}%p가 적용될 수 있습니다. `
              : '이 계산에 적용된 다주택 중과는 개정안의 특례규정에 따라 신고 시점에 따라 완화 세율이 적용될 수 있습니다. '}
            이 계산기는 신고 시점을 알 수 없어 자동으로 반영하지 않습니다 — 신고 전에 관할
            세무서 또는 세무 전문가와 확인하세요.
          </p>
        </div>
      )}

      {/* 지방소득세 개편안 미포함 — 다주택 중과에 개정안(완화) 룰이 실제 적용된 경우 특히 눈에 띄게.
          개편안의 개정 대상 법률에 지방세법이 없어 지방소득세는 현행 기준 그대로다 */}
      {result.heavyApplied &&
        result.appliedRules.some((r) => r.ruleKey === TRANSFER_RULE_KEYS.heavy && r.status === 'proposed') && (
        <div className="bg-caution-soft border-2 border-caution/40 rounded-lg p-4" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-caution mb-1">
            <AlertTriangle size={16} />
            지방소득세에는 개편안이 적용되지 않았습니다
          </p>
          <p className="text-sm text-ink leading-relaxed">
            다주택 중과 가산에는 개편안(완화) 기준이 적용됐지만, 이 개편안은 지방세법을
            포함하지 않아 지방소득세는 현행 기준으로 계산됩니다 — 국세만 완화되고
            지방소득세는 완화되지 않습니다.
          </p>
        </div>
      )}

      {/* 세액 카드 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6">
        <h2 className="font-serif font-bold text-ink mb-4">계산 결과</h2>

        {result.exempt ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="font-serif font-bold text-ink">낼 세금</span>
              <span className="font-mono text-xl font-bold text-pen">0원</span>
            </div>
            <div className="mt-4 bg-ok-soft border border-ok/25 rounded-md p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ok mb-1">
                <BadgeCheck size={16} />
                이 양도는 비과세입니다
              </p>
              <p className="text-sm text-ink leading-relaxed">{result.exemptReason}</p>
            </div>
          </>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">양도소득세</dt>
              <dd className="font-mono text-ink">{won(b.transferTax)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">지방소득세 (별도 세율표로 계산한 독립 세목)</dt>
              <dd className="font-mono text-ink">{won(b.localIncomeTax)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-rule">
              <dt className="font-serif font-bold text-ink">낼 세금 합계</dt>
              <dd className="font-mono text-xl font-bold text-pen">{won(b.totalTax)}</dd>
            </div>
          </dl>
        )}

        {/* 손에 쥐는 돈 */}
        <div className="mt-4 pt-4 border-t border-rule flex items-baseline justify-between gap-4">
          <span className="text-sm text-ink-soft">
            손에 쥐는 돈
            <span className="block text-xs text-ink-faint">양도가액 − 취득가액 − 필요경비 − 세금 합계</span>
          </span>
          <span className="font-mono font-bold text-ink">{won(b.netProceeds)}</span>
        </div>

        {/* 판정 배지 */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
            보유 {result.holdingYearsForRate}년(세율 기준) · {result.holdingYearsForLtsd}년(공제 기준)
          </span>
          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
            {result.regulatedAtTransfer ? '조정대상지역 (양도일 기준)' : '비규제지역 (양도일 기준)'}
          </span>
          {result.highPriceApplied && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-info-soft text-info">
              고가주택 — 초과분 {(result.taxableRatio * 100).toFixed(1)}%만 과세
            </span>
          )}
          {result.comparisonApplied && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-info-soft text-info">
              비교과세 — {RATE_PATH_LABELS[result.ratePathChosen]} 적용(더 큰 세액)
            </span>
          )}
        </div>
      </div>

      {/* 계산 과정 — 단계별 금액 */}
      {!result.exempt && (
        <div className="bg-paper-raised border border-rule rounded-lg p-6">
          <h2 className="font-serif font-bold text-ink mb-4">계산 과정</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">양도차익{result.highPriceApplied ? ' (고가주택 안분 후)' : ''}</dt>
              <dd className="font-mono text-ink">{won(b.transferGain)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">
                − 장기보유특별공제
                {result.ltsdPercentTotal > 0 ? ` (${result.ltsdPercentTotal}%${result.ltsdCapApplied ? ' · 물건별 한도 적용' : ''})` : ''}
              </dt>
              <dd className="font-mono text-ink">{won(b.ltsdAmount)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">= 양도소득금액</dt>
              <dd className="font-mono text-ink">{won(b.taxableGain)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">− 기본공제</dt>
              <dd className="font-mono text-ink">{won(b.basicDeduction)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-rule">
              <dt className="text-ink-soft">= 과세표준</dt>
              <dd className="font-mono font-semibold text-ink">{won(b.taxBase)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">→ 양도소득세</dt>
              <dd className="font-mono text-ink">{won(b.transferTax)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">→ 지방소득세</dt>
              <dd className="font-mono text-ink">{won(b.localIncomeTax)}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* 판정 사유 — 장기보유특별공제 표·중과·경과조치 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6 space-y-4">
        <h2 className="font-serif font-bold text-ink">판정 내역</h2>
        <div>
          <p className="text-sm font-semibold text-ink mb-1">
            장기보유특별공제 —{' '}
            {result.ltsdTable === 'one_house' ? '1세대 1주택 큰 표' : result.ltsdTable === 'general' ? '일반 표' : '적용 없음'}
          </p>
          <p className="text-sm text-ink-soft leading-relaxed">{result.ltsdReason}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink mb-1">
            다주택 중과 —{' '}
            {result.heavyExemptedByGrace ? '경과조치로 면제' : result.heavyApplied ? '적용' : '미적용'}
          </p>
          <p className="text-sm text-ink-soft leading-relaxed">{result.heavyReason}</p>
        </div>
        {/* 거주기간을 판정에 쓴 경우 — 산정 방식이 확인되지 않은 한계를 조건부로 안내 */}
        {result.residenceYearsUsed !== null && (
          <p className="text-xs text-ink-soft leading-relaxed border-t border-rule pt-3">
            이 결과는 거주기간 {result.residenceYearsUsed}년 입력을 근거로 판정했습니다. 거주기간
            산정의 초일 산입 방식은 법령·집행기준에서 확인되지 않아 보유기간과 같은 방식을
            전제로 했습니다. 경계에 걸리는 경우(요건 연수 직전·직후) 관할 세무서에 확인하세요.
          </p>
        )}
        {/* 개정안 모드 공통 — 지방소득세는 개편안 대상이 아님(지방세법 미포함)을 밝힌다 */}
        {result.ruleMode === 'proposed' && (
          <p className="text-xs text-ink-soft leading-relaxed border-t border-rule pt-3">
            이 개편안은 지방세법을 포함하지 않아 지방소득세는 현행 기준으로 계산됩니다.
          </p>
        )}
      </div>

      {/* 근거 영역 — 다른 계산기와 같은 형식 */}
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
