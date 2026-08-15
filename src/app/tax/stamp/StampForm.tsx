'use client'

/**
 * @컴포넌트: StampForm
 * @설명: 인지세 계산기 입력 폼 — 계약일·계약금액·주택 여부 세 가지만 받는다.
 *        계산은 서버 액션에서 수행하고 결과는 StampResultPanel이 표시한다.
 *        기준 금액·구간 숫자는 화면 어디에도 없다 — 판정은 전부 룰이 한다.
 */

import { useRef, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import SegmentControl from '@/components/common/SegmentControl'
import type { StampResult } from '@/lib/tax/engine-types'
import { calculateStamp } from './actions'
import CalcColumns, { CalcResultSlot, scrollResultIntoView } from '../_components/CalcColumns'
import StampResultPanel from './StampResultPanel'

/** 오늘 날짜(로컬 기준) YYYY-MM-DD */
function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function StampForm() {
  const [contractDate, setContractDate] = useState(todayString())
  const [price, setPrice] = useState('')
  const [isHousing, setIsHousing] = useState<'housing' | 'other'>('housing')
  const [result, setResult] = useState<StampResult | null>(null)
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
   *        입력값이 날아가지 않게 합니다(취득세 폼과 같은 관례).
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const priceNum = price.trim() === '' ? undefined : Number(price)
    if (priceNum === undefined || Number.isNaN(priceNum) || priceNum < 0) {
      setFormError('계약금액을 0 이상 숫자로 입력해 주세요.')
      return
    }

    startTransition(async () => {
      try {
        const res = await calculateStamp({
          contractDate,
          contractPrice: priceNum,
          isHousing: isHousing === 'housing',
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
      {/* onChange: 폼 안 어떤 입력이든 바뀌면 이전 결과를 지운다(버튼형 선택은 각 onChange에서) */}
      <form onSubmit={handleSubmit} onChange={clearStaleResult} className="bg-paper-raised border border-rule rounded-lg p-6 sm:p-8 space-y-5">
        <Field label="계약일" htmlFor="stamp-date" required>
          <Input id="stamp-date" type="date" value={contractDate}
            onChange={(e) => setContractDate(e.target.value)} required />
        </Field>

        <Field label="계약금액 — 계약서 기재금액 (원)" htmlFor="stamp-price" required>
          <Input id="stamp-price" type="number" min={0} step={1} value={price}
            onChange={(e) => setPrice(e.target.value)} placeholder="예: 550000000" required />
          {price !== '' && !Number.isNaN(Number(price)) && (
            <p className="text-xs text-ink-faint mt-1">{Number(price).toLocaleString('ko-KR')}원</p>
          )}
        </Field>

        <SegmentControl
          label="부동산 종류"
          value={isHousing}
          onChange={(v) => { setIsHousing(v === 'other' ? 'other' : 'housing'); clearStaleResult() }}
          options={[
            { value: 'housing', label: '주택' },
            { value: 'other', label: '주택 외' },
          ]}
        />

        {formError && <p className="text-sm font-medium text-seal" role="alert">{formError}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? '계산 중…' : '인지세 계산하기'}
        </Button>
      </form>

      {/* 결과 — 넓은 화면은 오른쪽 열, 계산 전·소멸 시 자리표시 (CalcResultSlot) */}
      <CalcResultSlot>
      {result && (
        <div ref={resultRef} className="scroll-mt-24">
          <StampResultPanel result={result} />
        </div>
      )}
      </CalcResultSlot>
    </CalcColumns>
  )
}
