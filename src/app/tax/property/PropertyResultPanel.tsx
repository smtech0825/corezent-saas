'use client'

/**
 * @컴포넌트: PropertyResultPanel
 * @설명: 재산세 계산 결과 표시 — 항목별 세액(본세·지방교육세·도시지역분·합계),
 *        계산 과정(공시가격 → 과세표준 → 상한 → 세액), 그리고 판정 내역
 *        (어떤 공정시장가액비율·세율표를 왜 썼는지, 상한 2종을 적용했는지 못 했다면 왜인지)을
 *        사유와 함께 그대로 보여준다. 연간 총액 기준임을 명시한다(실제 고지는 나뉠 수 있음).
 */

import { AlertTriangle, ExternalLink, ScrollText } from 'lucide-react'
import type { PropertyCapStatus, PropertyResult } from '@/lib/tax/property-types'
import CalcFailureNotice from '../_components/CalcFailureNotice'

/** 원화 표기 */
function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 상한 적용 상태 한 건 표시 — applied/not_exceeded/skipped 사유를 그대로 보여준다 */
function CapStatusBlock({ title, cap }: { title: string; cap: PropertyCapStatus }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink mb-1">
        {title} —{' '}
        {cap.status === 'applied' ? '적용됨' : cap.status === 'not_exceeded' ? '상한 이내 (영향 없음)' : '적용 안 함'}
      </p>
      <p className="text-sm text-ink-soft leading-relaxed">
        {cap.status === 'applied' && `상한액 ${won(cap.capAmount)}을 초과해 상한액으로 제한했습니다.`}
        {cap.status === 'not_exceeded' && `상한액은 ${won(cap.capAmount)}이며, 계산값이 그 이내라 세액에 영향이 없습니다.`}
        {cap.status === 'skipped' && cap.reason}
      </p>
    </div>
  )
}

export default function PropertyResultPanel({ result }: { result: PropertyResult }) {
  // ── 계산 불가 — 0원 대신 사유를 명확히 안내 (다른 계산기와 동일 문구 체계) ──
  if (!result.ok) {
    // 실패 원인(입력 부족·룰 미등록·근거 없음 등)별 안내는 공용 컴포넌트가 구분한다
    return <CalcFailureNotice failure={result} amountNoun="세액" />
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

      {/* 세액 카드 — 연간 총액 기준 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6">
        <h2 className="font-serif font-bold text-ink mb-4">계산 결과 (연간 총액)</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">재산세 본세</dt>
            <dd className="font-mono text-ink">{won(b.mainTax)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">지방교육세</dt>
            <dd className="font-mono text-ink">{won(b.localEducationTax)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">도시지역분{result.urbanAreaIncluded ? '' : ' (도시지역 아님 — 제외)'}</dt>
            <dd className="font-mono text-ink">{won(b.urbanAreaTax)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-rule">
            <dt className="font-serif font-bold text-ink">낼 세금 합계</dt>
            <dd className="font-mono text-xl font-bold text-pen">{won(b.total)}</dd>
          </div>
        </dl>
        <p className="text-xs text-ink-faint mt-3">
          연간 총액입니다. 실제 고지는 회차를 나눠 이뤄질 수 있습니다.
        </p>

        {/* 판정 배지 */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
            과세기준일 {result.baseDate}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
            공정시장가액비율 {result.assessmentRatioPercent}%
            {result.assessmentRatioType === 'one_house' ? ' (1세대 1주택 특례)' : ' (일반)'}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft">
            {result.rateTable === 'one_house_special' ? '1세대 1주택 특례세율표' : '일반 세율표'}
          </span>
          {result.baseCap.status === 'applied' && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-info-soft text-info">
              과세표준 상한 적용
            </span>
          )}
          {result.burdenCap.status === 'applied' && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-info-soft text-info">
              세부담 상한 적용
            </span>
          )}
        </div>
      </div>

      {/* 계산 과정 — 단계별 금액 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6">
        <h2 className="font-serif font-bold text-ink mb-4">계산 과정</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">과세표준 (공시가격 × {result.assessmentRatioPercent}%)</dt>
            <dd className="font-mono text-ink">{won(result.taxBaseBeforeCap)}</dd>
          </div>
          {result.baseCap.status === 'applied' && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">→ 과세표준 상한 적용 후</dt>
              <dd className="font-mono text-ink">{won(result.taxBase)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-rule">
            <dt className="text-ink-soft">→ 재산세 본세{result.burdenCap.status === 'applied' ? ' (세부담 상한 적용 후)' : ''}</dt>
            <dd className="font-mono text-ink">{won(b.mainTax)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-soft">→ 지방교육세 (본세 기준)</dt>
            <dd className="font-mono text-ink">{won(b.localEducationTax)}</dd>
          </div>
          {result.urbanAreaIncluded && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-ink-soft">→ 도시지역분 (과세표준 기준)</dt>
              <dd className="font-mono text-ink">{won(b.urbanAreaTax)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* 판정 내역 — 비율·세율표·상한 2종의 사유 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6 space-y-4">
        <h2 className="font-serif font-bold text-ink">판정 내역</h2>
        <div>
          <p className="text-sm font-semibold text-ink mb-1">
            공정시장가액비율 — {result.assessmentRatioType === 'one_house' ? '1세대 1주택 특례' : '일반'}
          </p>
          <p className="text-sm text-ink-soft leading-relaxed">{result.assessmentRatioReason}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink mb-1">
            세율표 — {result.rateTable === 'one_house_special' ? '1세대 1주택 특례' : '일반'}
          </p>
          <p className="text-sm text-ink-soft leading-relaxed">{result.rateTableReason}</p>
        </div>
        <CapStatusBlock title="과세표준 상한" cap={result.baseCap} />
        <CapStatusBlock title="세부담 상한" cap={result.burdenCap} />
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
