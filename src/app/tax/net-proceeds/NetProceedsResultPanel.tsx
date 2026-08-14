'use client'

/**
 * @컴포넌트: NetProceedsResultPanel
 * @설명: 매도 실수령액 계산 결과 표시 — 사람들이 실제로 궁금한 숫자는 세금이 아니라
 *        실수령액이므로 그것을 가장 크게 보여준다. 그 아래 양도가액에서 무엇이 얼마씩
 *        빠지는지 단계별로 표시한다.
 *        중개수수료가 상한액이면 '법정 상한 기준'임을 명시하고(실제는 협의로 결정),
 *        실제 입력액이 상한을 넘으면 경고한다. 양도세가 비과세면 사유를 그대로 보여준다.
 *        근거 목록은 여러 세목(양도소득세·중개수수료·공통)의 룰이 섞이므로
 *        룰 키 접두사로 세목 배지를 붙인다(등기비용 패널과 같은 방식 — 소형 중복).
 */

import { AlertTriangle, BadgeCheck, ExternalLink, ScrollText } from 'lucide-react'
import { TAX_TYPE_LABELS } from '@/lib/tax/labels'
import type { NetProceedsResult } from '@/lib/tax/net-proceeds-types'
import CalcFailureNotice from '../_components/CalcFailureNotice'

/** 원화 표기 */
function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 룰 키 접두사 → 세목 라벨 (등기비용 패널과 동일 관례 — 파일 분리로 인한 소형 중복) */
function taxTypeLabelOf(ruleKey: string): string {
  const prefix = ruleKey.split('.')[0]
  return (TAX_TYPE_LABELS as Record<string, string>)[prefix] ?? '공통'
}

/** 미확정 조건 필드명 → 한국어 라벨 (양도세 패널과 동일) */
const UNRESOLVED_LABELS: Record<string, string> = {
  residence_years: '거주기간',
  grace_contract: '중과 경과조치(계약 체결일·계약금 수령)',
  is_metro: '수도권 여부',
  sido: '시·도',
  sigungu: '시·군·구',
}

export default function NetProceedsResultPanel({ result }: { result: NetProceedsResult }) {
  // ── 계산 불가 — 0원 대신 사유를 명확히 안내 (다른 계산기와 동일 문구 체계) ──
  if (!result.ok) {
    // 실패 원인(입력 부족·룰 미등록·근거 없음 등)별 안내는 공용 컴포넌트가 구분한다
    return <CalcFailureNotice failure={result} amountNoun="실수령액" />
  }

  const b = result.breakdown
  const brk = result.brokerage

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

      {/* 실제 입력한 중개수수료가 법정 상한을 넘는 경우 — 경고 */}
      {brk.actualExceedsCap && (
        <div className="bg-caution-soft border-2 border-caution/40 rounded-lg p-4" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-caution mb-1">
            <AlertTriangle size={16} />
            입력한 중개수수료가 법정 상한을 넘습니다
          </p>
          <p className="text-sm text-ink leading-relaxed">
            입력액이 법정 상한액 {won(brk.capAmount)} + 부가세 {won(brk.vatAmount)}를 초과합니다.
            중개보수는 법정 상한을 넘을 수 없으니 금액을 확인해 보세요. 계산은 입력한 금액
            그대로 반영했습니다.
          </p>
        </div>
      )}

      {/* 실수령액 — 가장 크게 */}
      <div className="bg-paper-raised border-2 border-pen/30 rounded-lg p-6">
        <p className="text-sm text-ink-soft mb-1">아파트를 팔면 실제로 손에 쥐는 돈</p>
        <p className="font-mono text-3xl font-bold text-pen">{won(b.netProceeds)}</p>

        {/* 판정 배지 */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {result.transfer.exempt && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-ok-soft text-ok">
              양도소득세 비과세
            </span>
          )}
          {result.transfer.heavyApplied && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-caution-soft text-caution">
              다주택 중과 적용
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
            중개수수료 — {brk.isCap ? '법정 상한 기준' : '실제 입력액'}
          </span>
        </div>
      </div>

      {/* 단계별 차감 — 양도가액에서 무엇이 얼마씩 빠지는지 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6">
        <h2 className="font-serif font-bold text-ink mb-4">양도가액에서 빠지는 돈</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">양도가액</dt>
            <dd className="font-mono text-ink">{won(b.transferPrice)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">− 양도소득세{result.transfer.exempt ? ' (비과세)' : ''}</dt>
            <dd className="font-mono text-ink">{won(b.transferTax)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">− 지방소득세</dt>
            <dd className="font-mono text-ink">{won(b.localIncomeTax)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">− 중개수수료{brk.isCap ? ' (법정 상한 + 부가세 기준)' : ' (실제 입력액)'}</dt>
            <dd className="font-mono text-ink">{won(b.brokerageDeducted)}</dd>
          </div>
          {/* 미입력(0)이어도 행을 없애지 않는다 — 계산에 안 들어갔다는 사실을 보여준다
              (등기비용의 '입력하면 포함됩니다' 표시와 동일 원칙) */}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">− 그 밖의 비용</dt>
            <dd className={`font-mono ${b.otherCosts > 0 ? 'text-ink' : 'text-ink-faint text-sm'}`}>
              {b.otherCosts > 0 ? won(b.otherCosts) : '입력하면 포함됩니다'}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-rule">
            <dt className="font-serif font-bold text-ink">= 실수령액</dt>
            <dd className="font-mono text-xl font-bold text-pen">{won(b.netProceeds)}</dd>
          </div>
        </dl>
      </div>

      {/* 판정 내역 — 비과세 사유·중개수수료 상세 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6 space-y-4">
        <h2 className="font-serif font-bold text-ink">판정 내역</h2>
        {result.transfer.exempt && result.transfer.exemptReason && (
          <div className="bg-ok-soft border border-ok/25 rounded-md p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ok mb-1">
              <BadgeCheck size={16} />
              양도소득세가 비과세입니다
            </p>
            <p className="text-sm text-ink leading-relaxed">{result.transfer.exemptReason}</p>
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-ink mb-1">
            중개수수료 — {brk.isCap ? '법정 상한 기준' : '실제 입력액'}
          </p>
          <p className="text-sm text-ink-soft leading-relaxed">
            {brk.isCap
              ? `실제 지급액을 입력하지 않아 법정 상한액 ${won(brk.capAmount)}(상한 요율 ${brk.appliedRatePercent}%) + 부가세 ${won(brk.vatAmount)}로 계산했습니다. 실제 금액은 중개사와의 협의로 정해지므로 이보다 낮을 수 있습니다 — 실수령액은 그만큼 늘어납니다.`
              : `입력한 실제 지급액으로 계산했습니다. 참고로 법정 상한액은 ${won(brk.capAmount)}(상한 요율 ${brk.appliedRatePercent}%) + 부가세 ${won(brk.vatAmount)}입니다.`}
          </p>
        </div>
        {!result.transfer.exempt && (
          <p className="text-xs text-ink-soft leading-relaxed border-t border-rule pt-3">
            양도소득세의 자세한 계산 과정(공제·중과·비교과세 판정)은 양도소득세 계산기에서 같은
            입력으로 확인할 수 있습니다 — 이 계산기와 같은 룰로 계산됩니다.
          </p>
        )}
      </div>

      {/* 근거 영역 — 여러 세목의 룰이 섞이므로 세목 배지로 구분 */}
      <div className="bg-paper-raised border-2 border-pen/25 rounded-lg p-6">
        <h2 className="flex items-center gap-2 font-serif font-bold text-ink mb-1">
          <ScrollText size={18} className="text-pen" />
          적용된 법령 근거
        </h2>
        <p className="text-xs text-ink-soft mb-4">
          아래 근거가 이 계산에 실제로 적용되었습니다(양도소득세·중개수수료 계산에 쓰인 룰 포함).
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
