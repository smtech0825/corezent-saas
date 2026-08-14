'use client'

/**
 * @컴포넌트: StampResultPanel
 * @설명: 인지세 계산 결과 표시 — 세액과 적용 법령 근거(법령명·조문·시행일·원문 링크)를
 *        취득세 결과와 같은 형식으로 배치한다. 비과세면 0원만 보여주지 않고
 *        왜 세금이 없는지(룰의 비과세 사유)를 함께 표시한다.
 *        룰 미등록 등 계산 불가일 때는 0원 대신 사유를 그대로 안내한다.
 */

import { AlertTriangle, BadgeCheck, ExternalLink, ScrollText } from 'lucide-react'
import type { StampResult } from '@/lib/tax/engine-types'
import CalcFailureNotice from '../_components/CalcFailureNotice'

/** 원화 표기 */
function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export default function StampResultPanel({ result }: { result: StampResult }) {
  // ── 계산 불가 — 0원 대신 사유를 명확히 안내 (취득세와 동일 문구 체계) ──────
  if (!result.ok) {
    // 실패 원인(입력 부족·룰 미등록·근거 없음 등)별 안내는 공용 컴포넌트가 구분한다
    return <CalcFailureNotice failure={result} amountNoun="세액" />
  }

  return (
    <div className="space-y-4">
      {/* 세액 — 비과세면 사유를 같은 비중으로 함께 표시 */}
      <div className="bg-paper-raised border border-rule rounded-lg p-6">
        <h2 className="font-serif font-bold text-ink mb-4">계산 결과</h2>
        <div className="flex items-baseline justify-between">
          <span className="font-serif font-bold text-ink">인지세</span>
          <span className="font-mono text-xl font-bold text-pen">{won(result.amount)}</span>
        </div>
        {result.exempt && (
          <div className="mt-4 bg-ok-soft border border-ok/25 rounded-md p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ok mb-1">
              <BadgeCheck size={16} />
              이 계약은 인지세 비과세입니다
            </p>
            <p className="text-sm text-ink leading-relaxed">
              {result.exemptReason ?? '등록된 룰의 비과세 조건에 해당합니다.'}
            </p>
          </div>
        )}
        <p className="mt-4 pt-4 border-t border-rule text-xs text-ink-soft leading-relaxed">
          계약서 1통 기준입니다. 계약 당사자가 여럿이어도 한 통에는 한 번만 과세되며,
          계약서를 여러 통 작성하는 경우는 이 계산에 반영되지 않습니다.
        </p>
      </div>

      {/* 근거 영역 — 취득세와 같은 형식 */}
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
