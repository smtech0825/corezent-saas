'use client'

/**
 * @컴포넌트: NetProceedsForm
 * @설명: 매도 실수령액 계산기 입력 폼 — 양도소득세 계산기(TransferForm)와 같은 항목에
 *        실제 중개수수료(부가세 포함, 비우면 법정 상한액)와 그 밖의 비용(선택)을 더한 것.
 *        양도세 판정 입력(1주택 트랙·상속·경과조치)은 양도세 폼과 동일 구조를 유지한다 —
 *        입력이 다르면 두 계산기의 결과가 어긋나 보이기 때문이다.
 *        세율·요율·기준액 숫자는 화면 어디에도 없다 — 판정은 전부 룰이 한다.
 */

import { useRef, useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import SegmentControl from '@/components/common/SegmentControl'
import { REGIONS, findSigunguList } from '@/lib/tax/regions'
import type { TransferHouseCount } from '@/lib/tax/transfer-types'
import type { NetProceedsResult } from '@/lib/tax/net-proceeds-types'
import { calculateNetProceedsAction } from './actions'
import CalcColumns, { CalcResultSlot } from '../_components/CalcColumns'
import NetProceedsResultPanel from './NetProceedsResultPanel'

/** Input과 톤을 맞춘 select 클래스 (양도세 폼과 동일 관례) */
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

/** 체크박스 한 줄 (양도세 폼과 동일 관례) */
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

export default function NetProceedsForm({ graceDeadlineText }: {
  /** 중과 경과조치 계약 마감일 안내 문구 — 서버가 heavy 룰에서 읽어 넘긴다(양도세 폼과 동일) */
  graceDeadlineText?: string | null
}) {
  // ── 기본 입력 (양도세 폼과 동일) ───────────────────────────────────────────
  const [transferDate, setTransferDate] = useState(todayString())
  const [acquiredAt, setAcquiredAt] = useState('')
  const [sido, setSido] = useState('')
  const [sigungu, setSigungu] = useState('')
  const [transferPrice, setTransferPrice] = useState('')
  const [acquirePrice, setAcquirePrice] = useState('')
  const [houseCount, setHouseCount] = useState<TransferHouseCount>(1)
  const [residenceYears, setResidenceYears] = useState('')
  const [acquiredRegulated, setAcquiredRegulated] = useState<'' | 'yes' | 'no'>('')
  const [temporaryTwo, setTemporaryTwo] = useState(false)
  const [newHouseAcquiredAt, setNewHouseAcquiredAt] = useState('')
  // ── 고급 입력 (기본 접힘) ──────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [expenses, setExpenses] = useState('')
  const [actualBrokerage, setActualBrokerage] = useState('')
  const [otherCosts, setOtherCosts] = useState('')
  const [inherited, setInherited] = useState(false)
  const [inheritanceOpenedAt, setInheritanceOpenedAt] = useState('')
  const [decedentAcquiredAt, setDecedentAcquiredAt] = useState('')
  const [graceContractDate, setGraceContractDate] = useState('')
  const [graceDeposit, setGraceDeposit] = useState(false)
  // ── 결과 ──────────────────────────────────────────────────────────────────
  const [result, setResult] = useState<NetProceedsResult | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const resultRef = useRef<HTMLDivElement>(null)

  /** 입력이 바뀌면 이전 결과를 지운다 — 바뀐 입력과 무관한 옛 결과가 화면에 남는 것을 방지 */
  function clearStaleResult() {
    if (result) setResult(null)
  }

  const sigunguList = sido ? (findSigunguList(sido) ?? []) : []
  // 1주택 트랙 — 양도세 폼과 동일 기준(엔진의 effectiveOneHouse와 같다)
  const oneHouseTrack = houseCount === 1 || (houseCount === 2 && temporaryTwo)

  /**
   * @함수명: handleSubmit
   * @설명: 입력을 검증하고 서버 액션을 호출합니다. 검증 규칙은 양도세 폼과 동일하고
   *        실수령액 고유 항목(실제 중개수수료·그 밖의 비용)만 추가 검증합니다.
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
    const brokerNum = toNum(actualBrokerage)
    if (brokerNum !== undefined && (Number.isNaN(brokerNum) || brokerNum < 0)) {
      setFormError('실제 중개수수료를 0 이상 숫자(원)로 입력해 주세요.'); return
    }
    const otherNum = toNum(otherCosts)
    if (otherNum !== undefined && (Number.isNaN(otherNum) || otherNum < 0)) {
      setFormError('그 밖의 비용을 0 이상 숫자(원)로 입력해 주세요.'); return
    }
    if (oneHouseTrack && acquiredRegulated === '') {
      setFormError('취득 당시 조정대상지역 여부를 선택해 주세요. 모르면 취득 시점의 국토교통부 공고 또는 관할 시·군·구에서 확인할 수 있습니다.')
      return
    }
    // 미래 날짜 차단 — 양도세 폼과 동일(엔진도 같은 검증으로 이중 방어)
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
        const res = await calculateNetProceedsAction({
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
          actualBrokerageFee: brokerNum,
          otherCosts: otherNum,
        })
        setResult(res)
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      } catch {
        setFormError('계산 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })
  }

  return (
    <CalcColumns>
      {/* onChange: 폼 안 어떤 입력이든 바뀌면 이전 결과를 지운다(버튼형 선택은 각 onChange에서) */}
      <form onSubmit={handleSubmit} onChange={clearStaleResult} className="bg-paper-raised border border-rule rounded-lg p-6 sm:p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="취득일" htmlFor="np-acquired" required>
            <Input id="np-acquired" type="date" value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)} required />
          </Field>
          <Field label="양도일" htmlFor="np-date" required>
            <Input id="np-date" type="date" value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)} required />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="소재지 (시·도)" htmlFor="np-sido" required>
            <select id="np-sido" className={SELECT_CLS} value={sido}
              onChange={(e) => { setSido(e.target.value); setSigungu('') }}>
              <option value="">선택</option>
              {REGIONS.map((r) => <option key={r.sido} value={r.sido}>{r.sido}</option>)}
            </select>
          </Field>
          <Field label="시·군·구" htmlFor="np-sigungu" required
            hint="양도일 기준 조정대상지역 여부는 등록된 이력으로 자동 판정됩니다.">
            <select id="np-sigungu" className={SELECT_CLS} value={sigungu}
              onChange={(e) => setSigungu(e.target.value)} disabled={!sido}>
              <option value="">선택</option>
              {sigunguList.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="취득가액 (원)" htmlFor="np-acquire-price" required>
            <Input id="np-acquire-price" type="number" min={0} step={1} value={acquirePrice}
              onChange={(e) => setAcquirePrice(e.target.value)} placeholder="예: 600000000" required />
            <WonPreview value={acquirePrice} />
          </Field>
          <Field label="양도가액 (원)" htmlFor="np-price" required>
            <Input id="np-price" type="number" min={0} step={1} value={transferPrice}
              onChange={(e) => setTransferPrice(e.target.value)} placeholder="예: 900000000" required />
            <WonPreview value={transferPrice} />
          </Field>
        </div>

        <SegmentControl
          label="양도 당시 1세대 보유 주택 수"
          value={String(houseCount)}
          onChange={(v) => { setHouseCount(v === '2' ? 2 : v === '3' ? 3 : 1); clearStaleResult() }}
          options={[
            { value: '1', label: '1주택' },
            { value: '2', label: '2주택' },
            { value: '3', label: '3주택 이상' },
          ]}
        />

        {/* 2주택 — 일시적 2주택 판정용 입력 (양도세 폼과 동일) */}
        {houseCount === 2 && (
          <div className="space-y-4 border-l-2 border-pen/20 pl-4">
            <CheckRow label="일시적 2주택" hint="신규주택 취득으로 일시적으로 2주택이 된 경우 체크하세요. 요건을 충족하면 1주택으로 보아 판정합니다."
              checked={temporaryTwo} onChange={setTemporaryTwo} />
            {temporaryTwo && (
              <Field label="신규주택 취득일" htmlFor="np-new-house" required>
                <Input id="np-new-house" type="date" value={newHouseAcquiredAt}
                  onChange={(e) => setNewHouseAcquiredAt(e.target.value)} required />
              </Field>
            )}
          </div>
        )}

        {/* 1주택 트랙 — 비과세·장기보유특별공제 큰 표 판정용 입력 (양도세 폼과 동일) */}
        {oneHouseTrack && (
          <div className="space-y-4 border-l-2 border-pen/20 pl-4">
            <Field label="거주기간 (만 연수)" htmlFor="np-residence"
              hint="실제 거주한 만 연수. 산정 방식(초일 산입)은 법령·집행기준에서 확인되지 않아 보유기간과 같은 방식을 전제로 합니다.">
              <Input id="np-residence" type="number" min={0} step={1} value={residenceYears}
                onChange={(e) => setResidenceYears(e.target.value)} placeholder="예: 3" />
            </Field>
            <Field label="취득 당시 조정대상지역이었는지" htmlFor="np-acq-regulated" required
              hint="취득 시점의 지정 여부는 과거 이력이 시스템에 없어 자동 판정할 수 없습니다. 비과세 거주 요건 판정에만 쓰입니다.">
              <select id="np-acq-regulated" className={SELECT_CLS} value={acquiredRegulated}
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
          <p className="text-xs text-ink-faint mt-1.5">
            중개수수료를 비우면 법정 상한액(협의 전 최대치)으로 계산하고, 그 사실이 결과에 표시됩니다.
          </p>
          {advancedOpen && (
            <div className="mt-4 space-y-4">
              <Field label="실제 중개수수료 (원)" htmlFor="np-brokerage"
                hint="부가가치세를 포함한 실제 지급(예정) 금액을 입력하세요. 비우면 법정 상한액 + 부가세로 계산합니다 — 실제 금액은 협의로 정해지므로 상한보다 낮을 수 있습니다.">
                <Input id="np-brokerage" type="number" min={0} step={1} value={actualBrokerage}
                  onChange={(e) => setActualBrokerage(e.target.value)} placeholder="예: 5000000" />
                <WonPreview value={actualBrokerage} />
              </Field>
              <Field label="그 밖의 비용 (원)" htmlFor="np-other"
                hint="수리비·이사비 등 매도에 따르는 기타 지출. 비우면 0으로 봅니다.">
                <Input id="np-other" type="number" min={0} step={1} value={otherCosts}
                  onChange={(e) => setOtherCosts(e.target.value)} placeholder="예: 2000000" />
                <WonPreview value={otherCosts} />
              </Field>
              <Field label="필요경비 (원)" htmlFor="np-expenses"
                hint="취득세·중개수수료·자본적지출 등. 비우면 0으로 계산하며, 실제 세금은 이보다 낮을 수 있습니다.">
                <Input id="np-expenses" type="number" min={0} step={1} value={expenses}
                  onChange={(e) => setExpenses(e.target.value)} placeholder="예: 20000000" />
                <WonPreview value={expenses} />
              </Field>

              <CheckRow label="상속받은 주택" hint="보유기간 기산일이 달라집니다 — 세율용은 피상속인 취득일, 공제용은 상속개시일."
                checked={inherited} onChange={setInherited} />
              {inherited && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="상속개시일" htmlFor="np-inherit-open" required>
                    <Input id="np-inherit-open" type="date" value={inheritanceOpenedAt}
                      onChange={(e) => setInheritanceOpenedAt(e.target.value)} required />
                  </Field>
                  <Field label="피상속인 취득일" htmlFor="np-decedent" required>
                    <Input id="np-decedent" type="date" value={decedentAcquiredAt}
                      onChange={(e) => setDecedentAcquiredAt(e.target.value)} required />
                  </Field>
                </div>
              )}

              {/* 중과 경과조치 — 양도세 폼과 동일 안내 */}
              <div className="bg-caution-soft border border-caution/30 rounded-md p-4 space-y-3">
                <p className="text-sm font-semibold text-caution">다주택 중과 경과조치</p>
                <p className="text-xs text-ink leading-relaxed">
                  {graceDeadlineText
                    ? `${graceDeadlineText}까지 매매계약을 체결하고 계약금을 받았다면 아래에 입력하세요. `
                    : '중과 유예 종료 전에 매매계약을 체결하고 계약금을 받았다면 아래에 입력하세요. '}
                  적용 기한·기간은 등록된 룰 기준으로 판정됩니다.
                </p>
                <Field label="매매계약 체결일" htmlFor="np-grace-date">
                  <Input id="np-grace-date" type="date" value={graceContractDate}
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
          {isPending ? '계산 중…' : '실수령액 계산하기'}
        </Button>
      </form>

      {/* 결과 — 넓은 화면은 오른쪽 열, 계산 전·소멸 시 자리표시 (CalcResultSlot) */}
      <CalcResultSlot>
      {result && (
        <div ref={resultRef} className="scroll-mt-24">
          <NetProceedsResultPanel result={result} />
        </div>
      )}
      </CalcResultSlot>
    </CalcColumns>
  )
}
