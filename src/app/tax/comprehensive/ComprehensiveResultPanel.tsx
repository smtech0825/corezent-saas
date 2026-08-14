'use client'

/**
 * @컴포넌트: ComprehensiveResultPanel
 * @설명: 종합부동산세 계산 결과 표시 — "나도 내는 건가"가 가장 큰 관심사이므로
 *        과세 대상인지 아닌지를 맨 위에 가장 크게 보여준다. 대상이 아니면 사유와 함께
 *        재산세는 별도로 부과된다는 안내를 붙인다.
 *        계산 과정(공시가격 합계 → 기본공제 → 과세표준 → 산출세액 → 재산세 공제 →
 *        세액공제 → 최종)을 단계별 금액으로 보여주고, 세액공제는 연령분·보유기간분
 *        각각의 퍼센트와 합산 한도 도달 여부를 표시한다. 상한 처리도 사유와 함께 담는다.
 */

import { AlertTriangle, BadgeCheck, ExternalLink, ScrollText } from 'lucide-react'
import type { ComprehensiveResult } from '@/lib/tax/comprehensive-types'
import type { PropertyCapStatus } from '@/lib/tax/property-types'

/** 원화 표기 */
function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 상한 적용 상태 표시 (재산세 패널과 동일 관례 — 파일 분리로 인한 소형 중복) */
function CapStatusBlock({ title, cap }: { title: string; cap: PropertyCapStatus }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink mb-1">
        {title} —{' '}
        {cap.status === 'applied' ? '적용됨' : cap.status === 'not_exceeded' ? '상한 이내 (영향 없음)' : '적용 안 함'}
      </p>
      <p className="text-sm text-ink-soft leading-relaxed">
        {cap.status === 'applied' && `상한액 ${won(cap.capAmount)}을 초과해 초과분을 종합부동산세에서 덜어냈습니다.`}
        {cap.status === 'not_exceeded' && `상한액은 ${won(cap.capAmount)}이며, 계산값이 그 이내라 세액에 영향이 없습니다.`}
        {cap.status === 'skipped' && cap.reason}
      </p>
    </div>
  )
}

export default function ComprehensiveResultPanel({ result, totalOfficialPrice }: {
  result: ComprehensiveResult
  /** 제출 시점의 공시가격 합계 — 계산 과정 첫 단계 표시용 (결과와 쌍으로 전달받는다) */
  totalOfficialPrice: number
}) {
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
          세액이 0원이라는 뜻이 아닙니다. 계산에 필요한 근거 또는 입력이 준비되지 않아 결과를 제공하지 않는 것입니다.
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

      {/* 과세 대상 여부 — 이 계산기에서 가장 궁금한 답을 가장 크게, 맨 위에 */}
      {!result.taxable ? (
        <div className="bg-ok-soft border-2 border-ok/30 rounded-lg p-6">
          <p className="flex items-center gap-2 font-serif text-xl font-black text-ok mb-2">
            <BadgeCheck size={22} />
            종합부동산세 과세 대상이 아닙니다
          </p>
          <p className="text-sm text-ink leading-relaxed">{result.notTaxableReason}</p>
          <p className="text-xs text-ink-soft mt-3 border-t border-ok/20 pt-3">
            종합부동산세가 없어도 재산세는 별도로 부과됩니다 — 재산세 계산기에서 확인할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="bg-paper-raised border-2 border-pen/30 rounded-lg p-6">
          <p className="font-serif text-xl font-black text-ink mb-1">종합부동산세 과세 대상입니다</p>
          <div className="flex items-baseline justify-between gap-4 mt-3">
            <span className="font-serif font-bold text-ink">낼 세금 합계 (농어촌특별세 포함)</span>
            <span className="font-mono text-2xl font-bold text-pen">{won(b.total)}</span>
          </div>
          <dl className="mt-3 pt-3 border-t border-rule space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">종합부동산세</dt>
              <dd className="font-mono text-ink">{won(b.comprehensiveTax)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">농어촌특별세</dt>
              <dd className="font-mono text-ink">{won(b.ruralSurtax)}</dd>
            </div>
          </dl>

          {/* 판정 배지 */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
              과세기준일 {result.baseDate}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
              기본공제 {won(result.basicDeductionApplied)}
              {result.basicDeductionType === 'one_house' ? ' (1세대 1주택)' : ' (일반)'}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
              result.heavyTableApplied ? 'bg-caution-soft text-caution' : 'bg-paper-shade text-ink-soft'
            }`}>
              {result.heavyTableApplied ? '중과 세율표 적용' : '일반 세율표 적용'}
            </span>
            {result.burdenCap.status === 'applied' && (
              <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-info-soft text-info">
                세부담 상한 적용
              </span>
            )}
            {result.taxCredit?.capReached && (
              <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-info-soft text-info">
                세액공제 합산 한도 도달
              </span>
            )}
          </div>
        </div>
      )}

      {/* 계산 과정 — 단계별 금액 (과세 대상일 때만) */}
      {result.taxable && (
        <div className="bg-paper-raised border border-rule rounded-lg p-6">
          <h2 className="font-serif font-bold text-ink mb-4">계산 과정</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">공시가격 합계</dt>
              <dd className="font-mono text-ink">{won(totalOfficialPrice)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">
                − 기본공제 ({result.basicDeductionType === 'one_house' ? '1세대 1주택' : '일반'})
              </dt>
              <dd className="font-mono text-ink">{won(result.basicDeductionApplied)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-rule">
              <dt className="text-ink-soft">= 과세표준 (공정시장가액비율 반영)</dt>
              <dd className="font-mono font-semibold text-ink">{won(result.taxBase)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">→ 산출세액{result.heavyTableApplied ? ' (중과 세율표)' : ''}</dt>
              <dd className="font-mono text-ink">{won(b.rawTax)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">− 재산세 상당액 공제 (자동 계산)</dt>
              <dd className="font-mono text-ink">{won(b.propertyDeduction)}</dd>
            </div>
            {result.taxCredit && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-soft">− 세액공제 ({result.taxCredit.totalPercentApplied}%)</dt>
                <dd className="font-mono text-ink">{won(b.taxCreditAmount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-rule">
              <dt className="text-ink-soft">= 종합부동산세{result.burdenCap.status === 'applied' ? ' (세부담 상한 적용 후)' : ''}</dt>
              <dd className="font-mono font-semibold text-ink">{won(b.comprehensiveTax)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">+ 농어촌특별세</dt>
              <dd className="font-mono text-ink">{won(b.ruralSurtax)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-rule">
              <dt className="font-serif font-bold text-ink">= 합계</dt>
              <dd className="font-mono font-bold text-pen">{won(b.total)}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* 판정 내역 — 세율표·세액공제 상세·상한·재산세 공제 방식 */}
      {result.taxable && (
        <div className="bg-paper-raised border border-rule rounded-lg p-6 space-y-4">
          <h2 className="font-serif font-bold text-ink">판정 내역</h2>
          <div>
            <p className="text-sm font-semibold text-ink mb-1">
              세율표 — {result.heavyTableApplied ? '중과' : '일반'}
            </p>
            <p className="text-sm text-ink-soft leading-relaxed">{result.rateReason}</p>
          </div>
          {result.taxCredit && (
            <div>
              <p className="text-sm font-semibold text-ink mb-1">1세대 1주택 세액공제</p>
              <p className="text-sm text-ink-soft leading-relaxed">
                연령분 {result.taxCredit.agePercent}% + 보유기간분 {result.taxCredit.holdingPercent}%
                {result.taxCredit.capReached
                  ? ` — 합산 한도에 걸려 ${result.taxCredit.totalPercentApplied}%만 적용했습니다.`
                  : ` = ${result.taxCredit.totalPercentApplied}% 적용.`}{' '}
                공제액 {won(result.taxCredit.amount)}.
                {result.taxCredit.totalPercentApplied === 0 &&
                  ' 연령·보유기간이 공제 요건에 해당하지 않아 공제가 없습니다.'}
              </p>
            </div>
          )}
          <CapStatusBlock title="세부담 상한" cap={result.burdenCap} />
          <p className="text-xs text-ink-soft leading-relaxed border-t border-rule pt-3">
            재산세 상당액 공제는 등록된 재산세 룰(일반 공정시장가액비율·표준세율표)로 자동
            계산했습니다 — 따로 입력받지 않으며, 실제 부과된 재산세와는 차이가 있을 수 있습니다.
          </p>
        </div>
      )}

      {/* 근거 영역 — 다른 계산기와 같은 형식 (재산세 공제에 쓰인 재산세 룰 포함) */}
      <div className="bg-paper-raised border-2 border-pen/25 rounded-lg p-6">
        <h2 className="flex items-center gap-2 font-serif font-bold text-ink mb-1">
          <ScrollText size={18} className="text-pen" />
          적용된 법령 근거
        </h2>
        <p className="text-xs text-ink-soft mb-4">
          아래 근거가 이 계산에 실제로 적용되었습니다(재산세 상당액 공제 계산에 쓰인 재산세
          룰 포함). 숫자보다 이 근거를 먼저 확인하세요.
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
