'use client'

/**
 * @컴포넌트: RegistrationForm
 * @설명: 등기비용 계산기 입력 폼 — 취득세 계산기의 입력을 재사용하되 이번 계산에
 *        쓰이지 않는 항목(증여 관련)은 뺀다(매매 등기 전용).
 *        - 항상: 취득일·소재지·취득가액·전용면적·취득 후 주택 수·공시가격(채권 매입액 기준)
 *        - 고급(접힘): 채권 즉시매도 손실률(매일 변동 — 주택도시기금 포털에서 조회)·
 *          법무사 보수(자율 협의)·생애최초·일시적 2주택
 *        선택 항목을 비우면 0이 아니라 '포함하지 않음'으로 계산된다(엔진이 구분).
 *        수수료·매입률 숫자는 화면 어디에도 없다 — 판정은 전부 룰이 한다.
 */

import { useRef, useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { REGIONS, findSigunguList } from '@/lib/tax/regions'
import type { RegistrationResult } from '@/lib/tax/registration-types'
import { calculateRegistration } from './actions'
import RegistrationResultPanel from './RegistrationResultPanel'

/** Input과 톤을 맞춘 select 클래스 (다른 계산기 폼과 동일 관례) */
const SELECT_CLS =
  'w-full rounded-md border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink transition-colors focus:border-pen focus:ring-2 focus:ring-pen/15 focus:outline-none disabled:opacity-50'

/** 오늘 날짜(로컬 기준) YYYY-MM-DD */
function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

export default function RegistrationForm() {
  // ── 기본 입력 ──────────────────────────────────────────────────────────────
  const [baseDate, setBaseDate] = useState(todayString())
  const [sido, setSido] = useState('')
  const [sigungu, setSigungu] = useState('')
  const [price, setPrice] = useState('')
  const [officialPrice, setOfficialPrice] = useState('')
  const [houseCount, setHouseCount] = useState('1')
  const [areaSqm, setAreaSqm] = useState('')
  // ── 고급 입력 (기본 접힘) ──────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [bondLossPercent, setBondLossPercent] = useState('')
  const [judicialFee, setJudicialFee] = useState('')
  const [firstHome, setFirstHome] = useState(false)
  const [temporaryTwoHome, setTemporaryTwoHome] = useState(false)
  // ── 결과 ──────────────────────────────────────────────────────────────────
  const [result, setResult] = useState<RegistrationResult | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const resultRef = useRef<HTMLDivElement>(null)

  const sigunguList = sido ? (findSigunguList(sido) ?? []) : []

  /**
   * @함수명: handleSubmit
   * @설명: 입력을 검증하고 서버 액션을 호출합니다. 서버 액션 예외는 잡아서
   *        입력값이 날아가지 않게 합니다(다른 계산기 폼과 같은 관례).
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!sido || !sigungu) { setFormError('소재지를 목록에서 선택해 주세요.'); return }
    const priceNum = toNum(price)
    if (priceNum === undefined || Number.isNaN(priceNum) || priceNum <= 0) {
      setFormError('취득가액을 0보다 큰 숫자로 입력해 주세요.'); return
    }
    const officialNum = toNum(officialPrice)
    if (officialNum === undefined || Number.isNaN(officialNum) || officialNum <= 0) {
      setFormError('공시가격(시가표준액)을 0보다 큰 숫자로 입력해 주세요. 국민주택채권 매입액 계산의 기준입니다.'); return
    }
    const houseNum = toNum(houseCount)
    if (houseNum === undefined || Number.isNaN(houseNum) || houseNum < 1) {
      setFormError('취득 후 주택 수를 1 이상으로 입력해 주세요.'); return
    }
    const areaNum = toNum(areaSqm)
    if (areaNum === undefined || Number.isNaN(areaNum) || areaNum <= 0) {
      setFormError('전용면적을 0보다 큰 숫자(㎡)로 입력해 주세요.'); return
    }
    const lossNum = toNum(bondLossPercent)
    if (lossNum !== undefined && (Number.isNaN(lossNum) || lossNum < 0 || lossNum > 100)) {
      setFormError('채권 즉시매도 손실률을 0 이상 100 이하 숫자(%)로 입력해 주세요.'); return
    }
    const feeNum = toNum(judicialFee)
    if (feeNum !== undefined && (Number.isNaN(feeNum) || feeNum < 0)) {
      setFormError('법무사 보수를 0 이상 숫자(원)로 입력해 주세요.'); return
    }

    startTransition(async () => {
      try {
        const res = await calculateRegistration({
          baseDate,
          sido,
          sigungu,
          price: priceNum,
          officialPrice: officialNum,
          houseCountAfter: houseNum,
          areaSqm: areaNum,
          firstHome,
          temporaryTwoHome,
          bondLossPercent: lossNum,
          judicialFee: feeNum,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="취득일" htmlFor="rg-date" required>
            <Input id="rg-date" type="date" value={baseDate}
              onChange={(e) => setBaseDate(e.target.value)} required />
          </Field>
          <Field label="취득 후 주택 수" htmlFor="rg-house" required
            hint="이번 취득으로 1세대가 보유하게 되는 주택 수.">
            <Input id="rg-house" type="number" min={1} step={1} value={houseCount}
              onChange={(e) => setHouseCount(e.target.value)} required />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="소재지 (시·도)" htmlFor="rg-sido" required>
            <select id="rg-sido" className={SELECT_CLS} value={sido}
              onChange={(e) => { setSido(e.target.value); setSigungu('') }}>
              <option value="">선택</option>
              {REGIONS.map((r) => <option key={r.sido} value={r.sido}>{r.sido}</option>)}
            </select>
          </Field>
          <Field label="시·군·구" htmlFor="rg-sigungu" required
            hint="취득세 조정대상지역 여부는 등록된 이력으로 자동 판정됩니다.">
            <select id="rg-sigungu" className={SELECT_CLS} value={sigungu}
              onChange={(e) => setSigungu(e.target.value)} disabled={!sido}>
              <option value="">선택</option>
              {sigunguList.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="취득가액 (원)" htmlFor="rg-price" required>
            <Input id="rg-price" type="number" min={0} step={1} value={price}
              onChange={(e) => setPrice(e.target.value)} placeholder="예: 600000000" required />
            <WonPreview value={price} />
          </Field>
          <Field label="공시가격 (원)" htmlFor="rg-official" required
            hint="국민주택채권 매입액 계산의 기준이라 필수입니다. 부동산 공시가격 알리미에서 확인할 수 있습니다.">
            <Input id="rg-official" type="number" min={0} step={1} value={officialPrice}
              onChange={(e) => setOfficialPrice(e.target.value)} placeholder="예: 400000000" required />
            <WonPreview value={officialPrice} />
          </Field>
        </div>

        <Field label="전용면적 (㎡)" htmlFor="rg-area" required
          hint="취득세의 농어촌특별세 판정에 쓰입니다.">
          <Input id="rg-area" type="number" min={0} step="any" value={areaSqm}
            onChange={(e) => setAreaSqm(e.target.value)} placeholder="예: 84.9" required />
        </Field>

        {/* 고급 항목 — 기본 접힘. 채권 손실률·법무사 보수는 비우면 계산에서 빠진다 */}
        <div className="border-t border-rule pt-4">
          <button type="button" onClick={() => setAdvancedOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink transition-colors">
            고급 항목
            <ChevronDown size={15} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </button>
          <p className="text-xs text-ink-faint mt-1.5">
            채권 손실률·법무사 보수를 비우면 그 항목은 총액에서 빠지고, 그 사실이 결과에 표시됩니다.
          </p>
          {advancedOpen && (
            <div className="mt-4 space-y-4">
              <Field label="국민주택채권 즉시매도 손실률 (%)" htmlFor="rg-bond-loss"
                hint="채권을 사자마자 되팔 때의 손실 비율. 금리에 따라 매일 바뀌는 값이라 이 계산기가 정할 수 없습니다 — 주택도시기금 포털의 당일 고객부담금 조회에서 확인해 입력하세요. 비우면 채권 항목이 계산에서 빠집니다.">
                <Input id="rg-bond-loss" type="number" min={0} max={100} step="any" value={bondLossPercent}
                  onChange={(e) => setBondLossPercent(e.target.value)} placeholder="예: 12.5" />
              </Field>
              <Field label="법무사 보수 (원)" htmlFor="rg-judicial"
                hint="자율 협의라 정해진 값이 없습니다. 견적받은 금액을 입력하세요 — 비우면 계산에서 빠집니다.">
                <Input id="rg-judicial" type="number" min={0} step={1} value={judicialFee}
                  onChange={(e) => setJudicialFee(e.target.value)} placeholder="예: 300000" />
                <WonPreview value={judicialFee} />
              </Field>
              <CheckRow label="생애최초 주택 취득" hint="감면 해당 여부는 등록된 취득세 룰이 판정합니다."
                checked={firstHome} onChange={setFirstHome} />
              <CheckRow label="일시적 2주택" hint="종전 주택 처분을 전제로 한 일시적 2주택이면 체크하세요."
                checked={temporaryTwoHome} onChange={setTemporaryTwoHome} />
            </div>
          )}
        </div>

        {formError && <p className="text-sm font-medium text-seal" role="alert">{formError}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? '계산 중…' : '등기비용 계산하기'}
        </Button>
      </form>

      {/* 결과 */}
      {result && (
        <div ref={resultRef} className="scroll-mt-24">
          <RegistrationResultPanel result={result} />
        </div>
      )}
    </div>
  )
}
