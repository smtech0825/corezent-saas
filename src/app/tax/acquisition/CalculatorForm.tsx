'use client'

/**
 * @컴포넌트: CalculatorForm
 * @설명: 취득세 계산기 입력 폼 — 기본 항목 + 고급(접기) 항목, 룰 모드 전환(기본: 확정된 법).
 *        소재지는 시/도 → 시·군·구 선택만 허용(주소 직접 입력 불가 — 규제지역 판정을 위해).
 *        계산은 서버 액션에서 수행하고 결과는 ResultPanel이 표시한다.
 */

import { useRef, useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import SegmentControl from '@/components/common/SegmentControl'
import { REGIONS, findSigunguList } from '@/lib/tax/regions'
import type { AcquisitionCause, AcquisitionResult, DonorRelation } from '@/lib/tax/engine-types'
import type { TaxRuleMode } from '@/lib/tax/types'
import { calculateAcquisition } from './actions'
import ResultPanel from './ResultPanel'

/** Input과 톤을 맞춘 select 클래스 */
const SELECT_CLS =
  'w-full rounded-md border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink transition-colors focus:border-pen focus:ring-2 focus:ring-pen/15 focus:outline-none disabled:opacity-50'

/** 오늘 날짜(로컬 기준) YYYY-MM-DD */
function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 체크박스 한 줄 */
function CheckRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-pen"
      />
      <span className="text-sm text-ink">
        {label}
        {hint && <span className="block text-xs text-ink-faint mt-0.5">{hint}</span>}
      </span>
    </label>
  )
}

export default function CalculatorForm() {
  // ── 기본 입력 ──────────────────────────────────────────────────────────────
  const [baseDate, setBaseDate] = useState(todayString())
  const [sido, setSido] = useState('')
  const [sigungu, setSigungu] = useState('')
  const [cause, setCause] = useState<AcquisitionCause>('sale')
  const [price, setPrice] = useState('')
  const [houseCount, setHouseCount] = useState('1')
  const [areaOver85, setAreaOver85] = useState(false)
  // ── 고급 입력 (기본 접힘) ──────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [firstHome, setFirstHome] = useState(false)
  const [temporaryTwoHome, setTemporaryTwoHome] = useState(false)
  const [donorRelation, setDonorRelation] = useState<DonorRelation>('other')
  const [marketValue, setMarketValue] = useState('')
  const [officialPrice, setOfficialPrice] = useState('')
  const [donorSingleHome, setDonorSingleHome] = useState<'' | 'yes' | 'no'>('')
  // ── 룰 모드·결과 ──────────────────────────────────────────────────────────
  const [ruleMode, setRuleMode] = useState<TaxRuleMode>('confirmed')
  const [result, setResult] = useState<AcquisitionResult | null>(null)
  const [resultCause, setResultCause] = useState<AcquisitionCause>('sale')
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const resultRef = useRef<HTMLDivElement>(null)

  const sigunguList = sido ? (findSigunguList(sido) ?? []) : []

  /** 숫자 입력 문자열 → 숫자. 빈 값은 undefined, 잘못된 값은 NaN */
  function toNum(v: string): number | undefined {
    if (v.trim() === '') return undefined
    return Number(v)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const priceNum = toNum(price)
    const houseNum = toNum(houseCount)
    if (!sido || !sigungu) { setFormError('소재지를 목록에서 선택해 주세요.'); return }
    if (priceNum === undefined || Number.isNaN(priceNum) || priceNum < 0) {
      setFormError('취득가액을 0 이상 숫자로 입력해 주세요. (순수 증여는 0)'); return
    }
    if (houseNum === undefined || Number.isNaN(houseNum) || houseNum < 1) {
      setFormError('취득 후 주택 수를 1 이상으로 입력해 주세요.'); return
    }
    const mv = toNum(marketValue)
    const op = toNum(officialPrice)
    if ((mv !== undefined && Number.isNaN(mv)) || (op !== undefined && Number.isNaN(op))) {
      setFormError('시가인정액·공시가격은 숫자로 입력해 주세요.'); return
    }

    startTransition(async () => {
      const res = await calculateAcquisition({
        baseDate,
        sido,
        sigungu,
        cause,
        price: priceNum,
        houseCountAfter: houseNum,
        areaOver85,
        ruleMode,
        firstHome,
        temporaryTwoHome,
        donorRelation: cause === 'gift' ? donorRelation : undefined,
        marketValue: cause === 'gift' ? mv : undefined,
        officialPrice: cause === 'gift' ? op : undefined,
        donorIsSingleHomeOwner:
          cause === 'gift' && donorSingleHome !== '' ? donorSingleHome === 'yes' : undefined,
      })
      setResult(res)
      setResultCause(cause)
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-paper-raised border border-rule rounded-lg p-6 sm:p-8 space-y-5">
        {/* 룰 모드 — 기본값: 확정된 법 */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <SegmentControl
            label="계산 기준"
            value={ruleMode}
            onChange={(v) => setRuleMode(v === 'proposed' ? 'proposed' : 'confirmed')}
            options={[
              { value: 'confirmed', label: '확정된 법 기준' },
              { value: 'proposed', label: '개정안 포함' },
            ]}
          />
          {ruleMode === 'proposed' && (
            <p className="text-xs text-caution font-medium max-w-60 leading-relaxed">
              개정안은 국회 통과 전이라 확정이 아닙니다. 결과에 경고가 함께 표시됩니다.
            </p>
          )}
        </div>

        <Field label="취득일" htmlFor="tax-base-date" required>
          <Input id="tax-base-date" type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} required />
        </Field>

        {/* 소재지 — 목록 선택만 허용 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="소재지 (시·도)" htmlFor="tax-sido" required>
            <select
              id="tax-sido" className={SELECT_CLS} value={sido}
              onChange={(e) => { setSido(e.target.value); setSigungu('') }}
            >
              <option value="">선택</option>
              {REGIONS.map((r) => <option key={r.sido} value={r.sido}>{r.sido}</option>)}
            </select>
          </Field>
          <Field label="시·군·구" htmlFor="tax-sigungu" required>
            <select
              id="tax-sigungu" className={SELECT_CLS} value={sigungu}
              onChange={(e) => setSigungu(e.target.value)} disabled={!sido}
            >
              <option value="">선택</option>
              {sigunguList.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </Field>
        </div>

        <SegmentControl
          label="취득 원인"
          value={cause}
          onChange={(v) => setCause(v === 'gift' ? 'gift' : 'sale')}
          options={[
            { value: 'sale', label: '유상매매' },
            { value: 'gift', label: '증여' },
          ]}
        />

        <Field
          label={cause === 'gift' ? '취득가액 — 실제 지급한 대가 (원)' : '취득가액 (원)'}
          htmlFor="tax-price" required
          hint={cause === 'gift' ? '대가 없이 받은 순수 증여라면 0을 입력하세요.' : undefined}
        >
          <Input id="tax-price" type="number" min={0} step={1} value={price}
            onChange={(e) => setPrice(e.target.value)} placeholder="예: 550000000" required />
          {price !== '' && !Number.isNaN(Number(price)) && (
            <p className="text-xs text-ink-faint mt-1">{Number(price).toLocaleString('ko-KR')}원</p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="취득 후 1세대 주택 수" htmlFor="tax-house-count" required>
            <Input id="tax-house-count" type="number" min={1} step={1} value={houseCount}
              onChange={(e) => setHouseCount(e.target.value)} required />
          </Field>
          <div className="pb-2">
            <CheckRow label="전용면적 85㎡ 초과" checked={areaOver85} onChange={setAreaOver85} />
          </div>
        </div>

        {/* 고급 항목 — 기본 접힘 */}
        <div className="border-t border-rule pt-4">
          <button type="button" onClick={() => setAdvancedOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink transition-colors">
            고급 항목
            <ChevronDown size={15} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </button>
          {advancedOpen && (
            <div className="mt-4 space-y-4">
              <CheckRow label="생애최초 취득" hint="감면 룰이 등록된 경우에만 반영됩니다." checked={firstHome} onChange={setFirstHome} />
              <CheckRow label="일시적 2주택" hint="종전 주택 처분 예정인 일시적 2주택이라면 체크하세요." checked={temporaryTwoHome} onChange={setTemporaryTwoHome} />
              {cause === 'gift' && (
                <>
                  <Field label="증여자와의 관계" htmlFor="tax-donor-relation">
                    <select id="tax-donor-relation" className={SELECT_CLS} value={donorRelation}
                      onChange={(e) => setDonorRelation(e.target.value as DonorRelation)}>
                      <option value="other">그 외</option>
                      <option value="spouse">배우자</option>
                      <option value="lineal">직계존비속</option>
                    </select>
                  </Field>
                  <Field label="시가인정액 (원)" htmlFor="tax-market-value"
                    hint="매매사례가액·감정가액 등. 과세표준과 무상취득 간주 판정에 사용됩니다.">
                    <Input id="tax-market-value" type="number" min={0} step={1} value={marketValue}
                      onChange={(e) => setMarketValue(e.target.value)} placeholder="예: 800000000" />
                  </Field>
                  <Field label="공시가격 (원)" htmlFor="tax-official-price"
                    hint="규제지역 증여의 중과 판정에 사용됩니다.">
                    <Input id="tax-official-price" type="number" min={0} step={1} value={officialPrice}
                      onChange={(e) => setOfficialPrice(e.target.value)} placeholder="예: 600000000" />
                  </Field>
                  <Field label="증여자가 1주택자인지" htmlFor="tax-donor-single"
                    hint="소재지가 규제지역일 때 중과 제외 여부를 가르는 항목입니다. 모르면 '선택 안 함'으로 두세요.">
                    <select id="tax-donor-single" className={SELECT_CLS} value={donorSingleHome}
                      onChange={(e) => setDonorSingleHome(e.target.value as '' | 'yes' | 'no')}>
                      <option value="">선택 안 함</option>
                      <option value="yes">예 — 증여자가 1주택자</option>
                      <option value="no">아니요 — 2주택 이상</option>
                    </select>
                  </Field>
                </>
              )}
            </div>
          )}
        </div>

        {formError && <p className="text-sm font-medium text-seal" role="alert">{formError}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? '계산 중…' : '취득세 계산하기'}
        </Button>
      </form>

      {/* 결과 */}
      {result && (
        <div ref={resultRef} className="scroll-mt-24">
          <ResultPanel result={result} ruleMode={ruleMode} inputCause={resultCause} />
        </div>
      )}
    </div>
  )
}
