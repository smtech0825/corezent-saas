'use client'

/**
 * @컴포넌트: TransferForm
 * @설명: 양도소득세 계산기 입력 폼.
 *        - 항상: 취득일·양도일·취득가액·양도가액·주택 수·소재지(시·도→시·군·구)
 *        - 1주택: 거주기간 + '취득 당시' 조정대상지역 여부(과거 이력이 없어 직접 선택)
 *        - 2주택: 일시적 2주택 여부 + 신규주택 취득일
 *        - 고급(접힘): 필요경비·상속 관련 날짜·중과 경과조치(계약 체결일·계약금 수령)
 *        '양도 당시' 조정대상지역은 서버가 이력으로 자동 판정한다 — 취득 당시와 혼동 금지.
 *        세율·공제율·기준액 숫자는 화면 어디에도 없다 — 판정은 전부 룰이 한다.
 */

import { useRef, useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import SegmentControl from '@/components/common/SegmentControl'
import { REGIONS, findSigunguList } from '@/lib/tax/regions'
import type { TransferHouseCount, TransferResult } from '@/lib/tax/transfer-types'
import { calculateTransfer } from './actions'
import TransferResultPanel from './TransferResultPanel'

/** Input과 톤을 맞춘 select 클래스 (취득세 폼과 동일 관례) */
const SELECT_CLS =
  'w-full rounded-md border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink transition-colors focus:border-pen focus:ring-2 focus:ring-pen/15 focus:outline-none disabled:opacity-50'

/** 오늘 날짜(로컬 기준) YYYY-MM-DD */
function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 숫자 미리보기 한 줄 */
function WonPreview({ value }: { value: string }) {
  if (value === '' || Number.isNaN(Number(value))) return null
  return <p className="text-xs text-ink-faint mt-1">{Number(value).toLocaleString('ko-KR')}원</p>
}

/** 체크박스 한 줄 (취득세 폼과 동일 관례) */
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

export default function TransferForm({ graceDeadlineText }: {
  /** 중과 경과조치 계약 마감일 안내 문구(예: '2026년 5월 9일') — 서버가 heavy 룰에서 읽어
   *  넘긴다. 룰이 없거나 값을 못 읽으면 null — 날짜 없는 일반 문구로 표시한다. */
  graceDeadlineText?: string | null
}) {
  // ── 기본 입력 ──────────────────────────────────────────────────────────────
  const [transferDate, setTransferDate] = useState(todayString())
  const [acquiredAt, setAcquiredAt] = useState('')
  const [sido, setSido] = useState('')
  const [sigungu, setSigungu] = useState('')
  const [transferPrice, setTransferPrice] = useState('')
  const [acquirePrice, setAcquirePrice] = useState('')
  const [houseCount, setHouseCount] = useState<TransferHouseCount>(1)
  // ── 주택 수 조건부 입력 ────────────────────────────────────────────────────
  const [residenceYears, setResidenceYears] = useState('')
  const [acquiredRegulated, setAcquiredRegulated] = useState<'' | 'yes' | 'no'>('')
  const [temporaryTwo, setTemporaryTwo] = useState(false)
  const [newHouseAcquiredAt, setNewHouseAcquiredAt] = useState('')
  // ── 고급 입력 (기본 접힘) ──────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [expenses, setExpenses] = useState('')
  const [inherited, setInherited] = useState(false)
  const [inheritanceOpenedAt, setInheritanceOpenedAt] = useState('')
  const [decedentAcquiredAt, setDecedentAcquiredAt] = useState('')
  const [graceContractDate, setGraceContractDate] = useState('')
  const [graceDeposit, setGraceDeposit] = useState(false)
  // ── 결과 ──────────────────────────────────────────────────────────────────
  const [result, setResult] = useState<TransferResult | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const resultRef = useRef<HTMLDivElement>(null)

  const sigunguList = sido ? (findSigunguList(sido) ?? []) : []

  // 1주택 트랙 — 일시적 2주택도 1주택으로 보아 비과세·큰 표 판정을 받으므로
  // 거주기간·취득 당시 조정 여부 입력이 똑같이 필요하다 (엔진의 effectiveOneHouse와 동일 기준)
  const oneHouseTrack = houseCount === 1 || (houseCount === 2 && temporaryTwo)

  /**
   * @함수명: handleSubmit
   * @설명: 입력을 검증하고 서버 액션을 호출합니다. 서버 액션 예외는 잡아서
   *        입력값이 날아가지 않게 합니다(다른 계산기 폼과 같은 관례).
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!sido || !sigungu) { setFormError('소재지를 목록에서 선택해 주세요.'); return }
    if (!acquiredAt) { setFormError('취득일을 입력해 주세요.'); return }
    const priceNum = toNum(transferPrice)
    const acqNum = toNum(acquirePrice)
    if (priceNum === undefined || Number.isNaN(priceNum) || priceNum <= 0) {
      setFormError('양도가액을 0보다 큰 숫자로 입력해 주세요.'); return
    }
    if (acqNum === undefined || Number.isNaN(acqNum) || acqNum < 0) {
      setFormError('취득가액을 0 이상 숫자로 입력해 주세요.'); return
    }
    const expNum = toNum(expenses)
    if (expNum !== undefined && (Number.isNaN(expNum) || expNum < 0)) {
      setFormError('필요경비를 0 이상 숫자로 입력해 주세요.'); return
    }
    const resNum = toNum(residenceYears)
    if (resNum !== undefined && (Number.isNaN(resNum) || resNum < 0)) {
      setFormError('거주기간을 0 이상 숫자(만 연수)로 입력해 주세요.'); return
    }
    // 1주택 트랙은 취득 당시 조정 여부가 비과세 판정에 필요하다 — 서버 오류로 떠넘기지 않고 폼에서 요구
    if (oneHouseTrack && acquiredRegulated === '') {
      setFormError('취득 당시 조정대상지역 여부를 선택해 주세요. 모르면 취득 시점의 국토교통부 공고 또는 관할 시·군·구에서 확인할 수 있습니다.')
      return
    }
    // 미래 날짜 차단 — 양도일보다 뒤인 날짜는 판정을 왜곡한다 (엔진도 같은 검증으로 이중 방어)
    if (acquiredAt > transferDate) { setFormError('취득일이 양도일보다 늦을 수 없습니다.'); return }
    if (houseCount === 2 && temporaryTwo && newHouseAcquiredAt && newHouseAcquiredAt > transferDate) {
      setFormError('신규주택 취득일이 양도일보다 늦을 수 없습니다.'); return
    }
    if (inherited && inheritanceOpenedAt && inheritanceOpenedAt > transferDate) {
      setFormError('상속개시일이 양도일보다 늦을 수 없습니다.'); return
    }
    if (inherited && decedentAcquiredAt && decedentAcquiredAt > transferDate) {
      setFormError('피상속인 취득일이 양도일보다 늦을 수 없습니다.'); return
    }
    if (graceContractDate && graceContractDate > transferDate) {
      setFormError('매매계약 체결일이 양도일보다 늦을 수 없습니다.'); return
    }

    startTransition(async () => {
      try {
        const res = await calculateTransfer({
          transferDate,
          acquiredAt,
          sido,
          sigungu,
          transferPrice: priceNum,
          acquirePrice: acqNum,
          expenses: expNum,
          houseCount,
          residenceYears: oneHouseTrack ? resNum : undefined,
          acquiredInRegulatedArea:
            oneHouseTrack && acquiredRegulated !== '' ? acquiredRegulated === 'yes' : undefined,
          isTemporaryTwoHouse: houseCount === 2 ? temporaryTwo : undefined,
          newHouseAcquiredAt: houseCount === 2 && temporaryTwo && newHouseAcquiredAt ? newHouseAcquiredAt : undefined,
          inherited,
          inheritanceOpenedAt: inherited && inheritanceOpenedAt ? inheritanceOpenedAt : undefined,
          decedentAcquiredAt: inherited && decedentAcquiredAt ? decedentAcquiredAt : undefined,
          graceContractDate: graceContractDate || undefined,
          graceDepositReceived: graceContractDate ? graceDeposit : undefined,
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
          <Field label="취득일" htmlFor="tr-acquired" required>
            <Input id="tr-acquired" type="date" value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)} required />
          </Field>
          <Field label="양도일" htmlFor="tr-date" required>
            <Input id="tr-date" type="date" value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)} required />
          </Field>
        </div>

        {/* 소재지 — '양도 당시' 조정대상지역 여부는 서버가 이력으로 자동 판정 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="소재지 (시·도)" htmlFor="tr-sido" required>
            <select id="tr-sido" className={SELECT_CLS} value={sido}
              onChange={(e) => { setSido(e.target.value); setSigungu('') }}>
              <option value="">선택</option>
              {REGIONS.map((r) => <option key={r.sido} value={r.sido}>{r.sido}</option>)}
            </select>
          </Field>
          <Field label="시·군·구" htmlFor="tr-sigungu" required
            hint="양도일 기준 조정대상지역 여부는 등록된 이력으로 자동 판정됩니다.">
            <select id="tr-sigungu" className={SELECT_CLS} value={sigungu}
              onChange={(e) => setSigungu(e.target.value)} disabled={!sido}>
              <option value="">선택</option>
              {sigunguList.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="취득가액 (원)" htmlFor="tr-acquire-price" required>
            <Input id="tr-acquire-price" type="number" min={0} step={1} value={acquirePrice}
              onChange={(e) => setAcquirePrice(e.target.value)} placeholder="예: 600000000" required />
            <WonPreview value={acquirePrice} />
          </Field>
          <Field label="양도가액 (원)" htmlFor="tr-price" required>
            <Input id="tr-price" type="number" min={0} step={1} value={transferPrice}
              onChange={(e) => setTransferPrice(e.target.value)} placeholder="예: 900000000" required />
            <WonPreview value={transferPrice} />
          </Field>
        </div>

        <SegmentControl
          label="양도 당시 1세대 보유 주택 수"
          value={String(houseCount)}
          onChange={(v) => setHouseCount(v === '2' ? 2 : v === '3' ? 3 : 1)}
          options={[
            { value: '1', label: '1주택' },
            { value: '2', label: '2주택' },
            { value: '3', label: '3주택 이상' },
          ]}
        />

        {/* 2주택 — 일시적 2주택 판정용 입력 */}
        {houseCount === 2 && (
          <div className="space-y-4 border-l-2 border-pen/20 pl-4">
            <CheckRow label="일시적 2주택" hint="신규주택 취득으로 일시적으로 2주택이 된 경우 체크하세요. 요건을 충족하면 1주택으로 보아 판정합니다."
              checked={temporaryTwo} onChange={setTemporaryTwo} />
            {temporaryTwo && (
              <Field label="신규주택 취득일" htmlFor="tr-new-house" required>
                <Input id="tr-new-house" type="date" value={newHouseAcquiredAt}
                  onChange={(e) => setNewHouseAcquiredAt(e.target.value)} required />
              </Field>
            )}
          </div>
        )}

        {/* 1주택 트랙(1주택 또는 일시적 2주택) — 비과세·장기보유특별공제 큰 표 판정용 입력 */}
        {oneHouseTrack && (
          <div className="space-y-4 border-l-2 border-pen/20 pl-4">
            <Field label="거주기간 (만 연수)" htmlFor="tr-residence"
              hint="실제 거주한 만 연수. 산정 방식(초일 산입)은 법령·집행기준에서 확인되지 않아 보유기간과 같은 방식을 전제로 합니다.">
              <Input id="tr-residence" type="number" min={0} step={1} value={residenceYears}
                onChange={(e) => setResidenceYears(e.target.value)} placeholder="예: 3" />
            </Field>
            <Field label="취득 당시 조정대상지역이었는지" htmlFor="tr-acq-regulated" required
              hint="취득 시점의 지정 여부는 과거 이력이 시스템에 없어 자동 판정할 수 없습니다. 취득 당시 국토교통부 공고 또는 관할 시·군·구에서 확인 후 직접 선택하세요. 비과세 거주 요건 판정에만 쓰입니다.">
              <select id="tr-acq-regulated" className={SELECT_CLS} value={acquiredRegulated}
                onChange={(e) => setAcquiredRegulated(e.target.value as '' | 'yes' | 'no')}>
                <option value="">선택</option>
                <option value="yes">예 — 취득 당시 조정대상지역</option>
                <option value="no">아니요 — 취득 당시 비규제</option>
              </select>
            </Field>
          </div>
        )}

        {/* 고급 항목 — 기본 접힘 */}
        <div className="border-t border-rule pt-4">
          <button type="button" onClick={() => setAdvancedOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink transition-colors">
            고급 항목
            <ChevronDown size={15} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </button>
          {advancedOpen && (
            <div className="mt-4 space-y-4">
              <Field label="필요경비 (원)" htmlFor="tr-expenses"
                hint="취득세·중개수수료·자본적지출 등. 비우면 0으로 계산하며, 실제 세금은 이보다 낮을 수 있습니다.">
                <Input id="tr-expenses" type="number" min={0} step={1} value={expenses}
                  onChange={(e) => setExpenses(e.target.value)} placeholder="예: 20000000" />
                <WonPreview value={expenses} />
              </Field>

              <CheckRow label="상속받은 주택" hint="보유기간 기산일이 달라집니다 — 세율용은 피상속인 취득일, 공제용은 상속개시일."
                checked={inherited} onChange={setInherited} />
              {inherited && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="상속개시일" htmlFor="tr-inherit-open" required>
                    <Input id="tr-inherit-open" type="date" value={inheritanceOpenedAt}
                      onChange={(e) => setInheritanceOpenedAt(e.target.value)} required />
                  </Field>
                  <Field label="피상속인 취득일" htmlFor="tr-decedent" required>
                    <Input id="tr-decedent" type="date" value={decedentAcquiredAt}
                      onChange={(e) => setDecedentAcquiredAt(e.target.value)} required />
                  </Field>
                </div>
              )}

              {/* 중과 경과조치 — 해당자가 지금도 있으므로 눈에 띄게 안내 */}
              <div className="bg-caution-soft border border-caution/30 rounded-md p-4 space-y-3">
                <p className="text-sm font-semibold text-caution">다주택 중과 경과조치</p>
                <p className="text-xs text-ink leading-relaxed">
                  {graceDeadlineText
                    ? `${graceDeadlineText}까지 매매계약을 체결하고 계약금을 받았다면 아래에 입력하세요. `
                    : '중과 유예 종료 전에 매매계약을 체결하고 계약금을 받았다면 아래에 입력하세요. '}
                  계약일부터 일정 기간(지역별로 다름) 안에 양도하면 다주택 중과를 면할 수
                  있습니다. 적용 기한·기간은 등록된 룰 기준으로 판정됩니다.
                </p>
                <Field label="매매계약 체결일" htmlFor="tr-grace-date">
                  <Input id="tr-grace-date" type="date" value={graceContractDate}
                    onChange={(e) => setGraceContractDate(e.target.value)} />
                </Field>
                {graceContractDate && (
                  <CheckRow label="계약금을 받았습니다" checked={graceDeposit} onChange={setGraceDeposit} />
                )}
              </div>
            </div>
          )}
        </div>

        {formError && <p className="text-sm font-medium text-seal" role="alert">{formError}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? '계산 중…' : '양도소득세 계산하기'}
        </Button>
      </form>

      {/* 결과 */}
      {result && (
        <div ref={resultRef} className="scroll-mt-24">
          <TransferResultPanel result={result} />
        </div>
      )}
    </div>
  )
}
