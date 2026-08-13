'use client'

/**
 * @컴포넌트: BrokerageForm
 * @설명: 중개수수료 상한 계산기 입력 폼 — 기준일·거래 유형·소재지(시·도)·금액을 받는다.
 *        임대차는 보증금·월세를 따로 받아 서버(룰의 환산 방식)가 거래금액으로 환산한다.
 *        소재지는 시·도 목록 선택만 허용(취득세 폼과 같은 패턴 — 임의 입력 차단).
 *        요율·구간·한도액 숫자는 화면 어디에도 없다 — 판정은 전부 룰이 한다.
 */

import { useRef, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import SegmentControl from '@/components/common/SegmentControl'
import { REGIONS } from '@/lib/tax/regions'
import type { BrokerageDealType, BrokerageResult } from '@/lib/tax/engine-types'
import { calculateBrokerage } from './actions'
import BrokerageResultPanel from './BrokerageResultPanel'

/** Input과 톤을 맞춘 select 클래스 (취득세 폼과 동일 관례) */
const SELECT_CLS =
  'w-full rounded-md border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink transition-colors focus:border-pen focus:ring-2 focus:ring-pen/15 focus:outline-none disabled:opacity-50'

/** 오늘 날짜(로컬 기준) YYYY-MM-DD */
function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 숫자 미리보기 한 줄 — 입력값이 유효한 숫자일 때만 원화 표기를 보여준다 */
function WonPreview({ value }: { value: string }) {
  if (value === '' || Number.isNaN(Number(value))) return null
  return <p className="text-xs text-ink-faint mt-1">{Number(value).toLocaleString('ko-KR')}원</p>
}

export default function BrokerageForm() {
  const [baseDate, setBaseDate] = useState(todayString())
  const [dealType, setDealType] = useState<BrokerageDealType>('sale_exchange')
  const [sido, setSido] = useState('')
  const [price, setPrice] = useState('')
  const [deposit, setDeposit] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [result, setResult] = useState<BrokerageResult | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const resultRef = useRef<HTMLDivElement>(null)

  /**
   * @함수명: handleSubmit
   * @설명: 입력을 검증하고 서버 액션을 호출합니다. 서버 액션 예외는 잡아서
   *        입력값이 날아가지 않게 합니다(취득세·인지세 폼과 같은 관례).
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!sido) {
      setFormError('소재지(시·도)를 목록에서 선택해 주세요.')
      return
    }
    let priceNum: number | undefined
    let depositNum: number | undefined
    let monthlyNum: number | undefined
    if (dealType === 'sale_exchange') {
      priceNum = price.trim() === '' ? undefined : Number(price)
      if (priceNum === undefined || Number.isNaN(priceNum) || priceNum < 0) {
        setFormError('거래금액을 0 이상 숫자로 입력해 주세요.')
        return
      }
    } else {
      depositNum = deposit.trim() === '' ? undefined : Number(deposit)
      monthlyNum = monthlyRent.trim() === '' ? 0 : Number(monthlyRent)
      if (depositNum === undefined || Number.isNaN(depositNum) || depositNum < 0) {
        setFormError('보증금을 0 이상 숫자로 입력해 주세요.')
        return
      }
      if (Number.isNaN(monthlyNum) || monthlyNum < 0) {
        setFormError('월세를 0 이상 숫자로 입력해 주세요. (월세가 없으면 비워두세요)')
        return
      }
    }

    startTransition(async () => {
      try {
        const res = await calculateBrokerage({
          baseDate,
          dealType,
          sido,
          price: priceNum,
          deposit: depositNum,
          monthlyRent: monthlyNum,
        })
        setResult(res)
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      } catch {
        setFormError('계산 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-paper-raised border border-rule rounded-lg p-6 sm:p-8 space-y-5">
        <Field label="기준일 — 계약(예정)일" htmlFor="brokerage-date" required>
          <Input id="brokerage-date" type="date" value={baseDate}
            onChange={(e) => setBaseDate(e.target.value)} required />
        </Field>

        <SegmentControl
          label="거래 유형"
          value={dealType}
          onChange={(v) => setDealType(v === 'lease' ? 'lease' : 'sale_exchange')}
          options={[
            { value: 'sale_exchange', label: '매매·교환' },
            { value: 'lease', label: '임대차' },
          ]}
        />

        {/* 소재지 — 상한 요율이 시·도 조례로 정해지므로 시·도를 받는다 (목록 선택만 허용) */}
        <Field label="소재지 (시·도)" htmlFor="brokerage-sido" required
          hint="중개보수 상한 요율은 시·도 조례로 정해져 지역마다 다를 수 있습니다.">
          <select
            id="brokerage-sido" className={SELECT_CLS} value={sido}
            onChange={(e) => setSido(e.target.value)}
          >
            <option value="">선택</option>
            {REGIONS.map((r) => <option key={r.sido} value={r.sido}>{r.sido}</option>)}
          </select>
        </Field>

        {dealType === 'sale_exchange' ? (
          <Field label="거래금액 (원)" htmlFor="brokerage-price" required>
            <Input id="brokerage-price" type="number" min={0} step={1} value={price}
              onChange={(e) => setPrice(e.target.value)} placeholder="예: 550000000" required />
            <WonPreview value={price} />
          </Field>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="보증금 (원)" htmlFor="brokerage-deposit" required>
              <Input id="brokerage-deposit" type="number" min={0} step={1} value={deposit}
                onChange={(e) => setDeposit(e.target.value)} placeholder="예: 300000000" required />
              <WonPreview value={deposit} />
            </Field>
            <Field label="월세 (원)" htmlFor="brokerage-monthly"
              hint="전세처럼 월세가 없으면 비워두세요. 거래금액 환산은 등록된 룰의 방식을 따릅니다.">
              <Input id="brokerage-monthly" type="number" min={0} step={1} value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)} placeholder="예: 500000" />
              <WonPreview value={monthlyRent} />
            </Field>
          </div>
        )}

        {formError && <p className="text-sm font-medium text-seal" role="alert">{formError}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? '계산 중…' : '중개보수 상한 계산하기'}
        </Button>
      </form>

      {/* 결과 */}
      {result && (
        <div ref={resultRef} className="scroll-mt-24">
          <BrokerageResultPanel result={result} />
        </div>
      )}
    </div>
  )
}
