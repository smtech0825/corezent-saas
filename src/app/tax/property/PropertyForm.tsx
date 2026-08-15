'use client'

/**
 * @컴포넌트: PropertyForm
 * @설명: 재산세 계산기 입력 폼 — 입력을 늘리지 않는다는 대원칙(누구나 직관적으로).
 *        - 항상: 과세연도·공시가격·1세대 1주택 여부 (3개)
 *        - 고급(접힘): 도시지역 여부(기본 해당)·직전 연도 과세표준·직전 연도 재산세액
 *        직전 연도 값을 비우면 상한이 적용되지 않아 실제 고지서보다 높게 나올 수 있다는
 *        안내를 고급 항목에 붙인다(추정 금지 — 모르면 비워 두는 것이 안전한 방향).
 *        세율·비율·기준액 숫자는 화면 어디에도 없다 — 판정은 전부 룰이 한다.
 */

import { useRef, useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import type { PropertyResult } from '@/lib/tax/property-types'
import { calculateProperty } from './actions'
import CalcColumns, { CalcResultSlot, scrollResultIntoView } from '../_components/CalcColumns'
import PropertyResultPanel from './PropertyResultPanel'

/** 숫자 미리보기 한 줄 (다른 계산기 폼과 동일 관례) */
function WonPreview({ value }: { value: string }) {
  if (value === '' || Number.isNaN(Number(value))) return null
  return <p className="text-xs text-ink-faint mt-1">{Number(value).toLocaleString('ko-KR')}원</p>
}

/** 체크박스 한 줄 (다른 계산기 폼과 동일 관례) */
function CheckRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-pen" />
      <span className="text-sm text-ink">
        {label}
        {hint && <span className="block text-xs text-ink-faint mt-0.5">{hint}</span>}
      </span>
    </label>
  )
}

/** 문자열 → 숫자. 빈 값은 undefined */
function toNum(v: string): number | undefined {
  if (v.trim() === '') return undefined
  return Number(v)
}

export default function PropertyForm() {
  // ── 기본 입력 ──────────────────────────────────────────────────────────────
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()))
  const [officialPrice, setOfficialPrice] = useState('')
  const [isOneHouse, setIsOneHouse] = useState(false)
  // ── 고급 입력 (기본 접힘) ──────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [isUrbanArea, setIsUrbanArea] = useState(true)
  const [prevTaxBase, setPrevTaxBase] = useState('')
  const [prevTaxAmount, setPrevTaxAmount] = useState('')
  // ── 결과 ──────────────────────────────────────────────────────────────────
  const [result, setResult] = useState<PropertyResult | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const resultRef = useRef<HTMLDivElement>(null)

  /** 입력이 바뀌면 이전 결과를 지운다 — 바뀐 입력과 무관한 옛 결과가 화면에 남는 것을 방지 */
  function clearStaleResult() {
    if (result) setResult(null)
  }

  /**
   * @함수명: handleSubmit
   * @설명: 입력을 검증하고 서버 액션을 호출합니다. 서버 액션 예외는 잡아서
   *        입력값이 날아가지 않게 합니다(다른 계산기 폼과 같은 관례).
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const yearNum = Number(taxYear)
    if (!Number.isInteger(yearNum) || taxYear.trim().length !== 4) {
      setFormError('과세연도는 4자리 연도로 입력해 주세요.'); return
    }
    const priceNum = toNum(officialPrice)
    if (priceNum === undefined || Number.isNaN(priceNum) || priceNum <= 0) {
      setFormError('공시가격을 0보다 큰 숫자로 입력해 주세요.'); return
    }
    const prevBaseNum = toNum(prevTaxBase)
    if (prevBaseNum !== undefined && (Number.isNaN(prevBaseNum) || prevBaseNum < 0)) {
      setFormError('직전 연도 과세표준을 0 이상 숫자로 입력해 주세요.'); return
    }
    const prevAmountNum = toNum(prevTaxAmount)
    if (prevAmountNum !== undefined && (Number.isNaN(prevAmountNum) || prevAmountNum < 0)) {
      setFormError('직전 연도 재산세액을 0 이상 숫자로 입력해 주세요.'); return
    }

    startTransition(async () => {
      try {
        const res = await calculateProperty({
          taxYear: yearNum,
          officialPrice: priceNum,
          isOneHouse,
          isUrbanArea,
          prevTaxBase: prevBaseNum,
          prevTaxAmount: prevAmountNum,
        })
        setResult(res)
        scrollResultIntoView(resultRef)
      } catch {
        setFormError('계산 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })
  }

  return (
    <CalcColumns>
      {/* onChange: 폼 안 어떤 입력이든 바뀌면 이전 결과를 지운다 */}
      <form onSubmit={handleSubmit} onChange={clearStaleResult} className="bg-paper-raised border border-rule rounded-lg p-6 sm:p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="과세연도" htmlFor="pr-year" required
            hint="세금을 계산할 연도입니다. 과세기준일은 등록된 룰로 자동 판정됩니다.">
            <Input id="pr-year" type="number" step={1} value={taxYear}
              onChange={(e) => setTaxYear(e.target.value)} required />
          </Field>
          <Field label="공시가격 (원)" htmlFor="pr-price" required
            hint="부동산 공시가격 알리미에서 확인한 공동주택 공시가격.">
            <Input id="pr-price" type="number" min={0} step={1} value={officialPrice}
              onChange={(e) => setOfficialPrice(e.target.value)} placeholder="예: 600000000" required />
            <WonPreview value={officialPrice} />
          </Field>
        </div>

        <CheckRow label="1세대 1주택입니다"
          hint="1세대가 주택 1채만 보유한 경우. 공정시장가액비율·세율 특례 판정에 쓰입니다."
          checked={isOneHouse} onChange={setIsOneHouse} />

        {/* 고급 항목 — 기본 접힘. 직전 연도 값은 상한(세액을 낮추는 장치) 판정용 */}
        <div className="border-t border-rule pt-4">
          <button type="button" onClick={() => setAdvancedOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink transition-colors">
            고급 항목
            <ChevronDown size={15} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </button>
          <p className="text-xs text-ink-faint mt-1.5">
            모르면 비워두세요. 상한이 적용되지 않아 실제 고지서보다 높게 나올 수 있습니다.
          </p>
          {advancedOpen && (
            <div className="mt-4 space-y-4">
              <CheckRow label="도시지역입니다 (도시지역분 포함)"
                hint="아파트는 대부분 해당합니다. 해당하지 않으면 체크를 해제하세요 — 도시지역분이 제외됩니다."
                checked={isUrbanArea} onChange={setIsUrbanArea} />
              <Field label="직전 연도 과세표준 (원)" htmlFor="pr-prev-base"
                hint="작년 재산세 고지서의 과세표준. 입력하면 과세표준 상한이 적용됩니다. 작년 부과가 없었다면(신축 취득 등) 0 대신 비워 두세요.">
                <Input id="pr-prev-base" type="number" min={0} step={1} value={prevTaxBase}
                  onChange={(e) => setPrevTaxBase(e.target.value)} placeholder="예: 250000000" />
                <WonPreview value={prevTaxBase} />
              </Field>
              <Field label="직전 연도 재산세액 (본세, 원)" htmlFor="pr-prev-amount"
                hint="작년 고지서의 재산세 본세(도시지역분·지방교육세 제외). 입력하면 세부담 상한이 적용됩니다. 작년 부과가 없었다면 0 대신 비워 두세요.">
                <Input id="pr-prev-amount" type="number" min={0} step={1} value={prevTaxAmount}
                  onChange={(e) => setPrevTaxAmount(e.target.value)} placeholder="예: 400000" />
                <WonPreview value={prevTaxAmount} />
              </Field>
            </div>
          )}
        </div>

        {formError && <p className="text-sm font-medium text-seal" role="alert">{formError}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? '계산 중…' : '재산세 계산하기'}
        </Button>
      </form>

      {/* 결과 — 넓은 화면은 오른쪽 열, 계산 전·소멸 시 자리표시 (CalcResultSlot) */}
      <CalcResultSlot>
      {result && (
        <div ref={resultRef} className="scroll-mt-24">
          <PropertyResultPanel result={result} />
        </div>
      )}
      </CalcResultSlot>
    </CalcColumns>
  )
}
