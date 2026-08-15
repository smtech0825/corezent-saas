/**
 * @컴포넌트: YearComparisonSection
 * @설명: 연도별 비교 카드 묶음 — 양도소득세·종합부동산세 공용 표시 컴포넌트.
 *        세목별 어댑터(TransferComparisonCards·ComprehensiveComparisonCards)가 엔진
 *        결과를 YearCardData로 정규화해 넘긴다. 연도 목록·세액·사유는 전부 데이터
 *        (등록된 룰·엔진 결과)에서 오며, 이 파일에는 연도·금액·세율 숫자가 없다.
 *        - 총 세액을 가장 크게, 올해(기준 연도) 대비 증감을 금액·비율 함께 표시
 *        - 늘어나는 해/줄어드는 해는 색+부호+문구 셋으로 구분(색만으로 구분하지 않는다)
 *        - 개정안 카드마다 '확정 아님' 배지, 묶음 전체에도 경고 박스 — 이 서비스가
 *          잘못된 정보의 발신처가 되지 않게 하는 핵심 표시이므로 약하게 만들지 말 것
 *        - 실패한 해도 카드를 두고 사유를 표시한다(조용히 빠지면 왜 없는지 모른다)
 *        - 배치: 세로(모바일) → 2×2(sm) → 3~4열(xl, 카드 수에 맞춤) — 가로 스크롤 금지
 */

import { AlertTriangle } from 'lucide-react'
import type { TaxRuleMode } from '@/lib/tax/types'

/** 카드 하나의 표시 데이터 — 세목별 어댑터가 엔진 결과에서 뽑아 채운다 */
export interface YearCardData {
  year: number
  /** 이 해를 어느 기준으로 계산했는지 — 배지·테두리 표시의 근거 */
  ruleMode: TaxRuleMode
  /** 기준 연도(올해) 여부 — 증감 표시의 기준 */
  isBaseYear: boolean
  ok: boolean
  /** 성공 시 총 세액(원) */
  totalTax?: number
  /** 성공 시 — 왜 이 값인지 한 줄(공제율·기본공제 등, 수치는 전부 엔진 결과=룰에서) */
  reasonLine?: string
  /** 성공했지만 값 미입력(미확정)으로 판정하지 못한 조건이 있는지 */
  hasUnresolved?: boolean
  /** 실패 시 안내문(엔진의 한국어 메시지) */
  failMessage?: string
}

/** 올해 대비 증감 한 줄 — 부호(▲▼)+금액+문구+비율. 색만으로 구분하지 않는다 */
function DiffLine({ total, baseTotal }: { total: number; baseTotal: number | null }) {
  if (baseTotal === null) {
    return <p className="text-xs text-ink-faint mt-1">올해 결과가 없어 증감을 비교할 수 없습니다</p>
  }
  const diff = total - baseTotal
  if (diff === 0) return <p className="text-xs font-medium text-ink-soft mt-1">올해와 같음</p>
  const up = diff > 0
  // 비율은 소수 1자리 반올림 — 올해가 0원이면 비율을 정의할 수 없어 금액만 표시한다
  const pct = baseTotal > 0 ? Math.round((Math.abs(diff) / baseTotal) * 1000) / 10 : null
  return (
    <p className={`text-xs font-semibold mt-1 ${up ? 'text-seal' : 'text-ok'}`}>
      {up ? '▲' : '▼'} {Math.abs(diff).toLocaleString('ko-KR')}원 {up ? '늘어남' : '줄어듦'}
      {pct !== null && ` (${up ? '+' : '−'}${pct}%)`}
    </p>
  )
}

/** 연도 카드 한 장 — 개정안이면 배지·테두리로 확정 아님을 분명히 표시한다 */
function YearCard({ card, baseTotal }: { card: YearCardData; baseTotal: number | null }) {
  const proposed = card.ruleMode === 'proposed'
  return (
    <div className={`min-w-0 bg-paper-raised rounded-lg p-4 border ${proposed ? 'border-caution/40' : 'border-rule'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-serif font-bold text-ink">{card.year}년</span>
        {proposed ? (
          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-caution-soft text-caution whitespace-nowrap">
            개정안 — 확정 아님
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-soft whitespace-nowrap">
            확정된 법 기준
          </span>
        )}
      </div>
      {card.ok && typeof card.totalTax === 'number' ? (
        <>
          <p className="text-2xl font-serif font-black text-ink leading-tight">
            {card.totalTax.toLocaleString('ko-KR')}
            <span className="text-sm font-semibold text-ink-soft ml-0.5">원</span>
          </p>
          {card.isBaseYear ? (
            <p className="text-xs font-medium text-ink-soft mt-1">올해 — 비교 기준</p>
          ) : (
            <DiffLine total={card.totalTax} baseTotal={baseTotal} />
          )}
          {card.reasonLine && (
            <p className="text-xs text-ink-soft mt-2 leading-relaxed">{card.reasonLine}</p>
          )}
          {card.hasUnresolved && (
            <p className="text-[11px] text-caution mt-1.5 leading-relaxed">
              판정하지 못한 조건이 있어 실제와 다를 수 있습니다.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-ink-faint">이 해는 계산하지 못했습니다</p>
          {card.failMessage && (
            <p className="text-xs text-ink-faint mt-1.5 leading-relaxed">{card.failMessage}</p>
          )}
        </>
      )}
    </div>
  )
}

/** 비교 묶음 전체 — 제목·개정안 경고 박스·카드 그리드 */
export default function YearComparisonSection({ subtitle, cards }: {
  /** 세목별 부제 — 무엇을 어떻게 바꿔 비교했는지(예: '양도 연도만 바꿔 다시 계산') */
  subtitle: string
  cards: YearCardData[]
}) {
  if (cards.length === 0) return null
  const base = cards.find((c) => c.isBaseYear && c.ok && typeof c.totalTax === 'number')
  const baseTotal = base?.totalTax ?? null
  // 카드 수에 맞춘 넓은 화면 열 수 — 4장 이상 4열, 3장 3열, 그 외 sm 2열 유지
  const xlCols = cards.length >= 4 ? 'xl:grid-cols-4' : cards.length === 3 ? 'xl:grid-cols-3' : ''

  return (
    <section aria-label="연도별 비교" className="mt-8">
      <h2 className="font-serif font-bold text-ink mb-1">연도별 비교</h2>
      <p className="text-xs text-ink-soft mb-3 leading-relaxed">{subtitle}</p>

      {/* 개정안 경고 — 날짜·수치를 문구에 넣지 않는다(연도·세액은 카드가 데이터에서 표시) */}
      <div className="bg-caution-soft border-2 border-caution/40 rounded-lg p-4 mb-4" role="alert">
        <p className="flex items-center gap-2 text-sm font-semibold text-caution mb-1">
          <AlertTriangle size={15} /> 개정안 연도의 세액은 확정이 아닙니다
        </p>
        <p className="text-xs text-caution/90 leading-relaxed">
          2026년 세제개편안은 아직 국회 통과 전입니다. 심사 과정에서 내용이 바뀌거나 시행
          시점이 미뤄질 수 있고, 항목별로 시행 시점이 달라 같은 개정안 안에서도 해마다
          적용이 다릅니다. 참고용으로만 보시고, 실제 신고·납부는 그 시점의 확정된 법을
          기준으로 하세요.
        </p>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${xlCols} gap-3`}>
        {cards.map((c) => (
          <YearCard key={c.year} card={c} baseTotal={baseTotal} />
        ))}
      </div>
    </section>
  )
}
