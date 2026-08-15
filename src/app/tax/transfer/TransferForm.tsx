'use client'

/**
 * @컴포넌트: TransferForm
 * @설명: 양도소득세 계산기 입력 폼.
 *        - 항상: 취득일·양도일·취득가액·양도가액·주택 수·소재지(시·도→시·군·구)·
 *          거주기간(선택 — 1주택 판정과 개정안 거주 기준 장특공제에 사용, 전 주택 수 노출)
 *        - 1주택: '취득 당시' 조정대상지역 여부(과거 이력이 없어 직접 선택)
 *        - 2주택: 일시적 2주택 여부 + 신규주택 취득일
 *        - 고급(접힘): 필요경비·상속 관련 날짜·중과 경과조치(계약 체결일·계약금 수령)
 *        '양도 당시' 조정대상지역은 서버가 이력으로 자동 판정한다 — 취득 당시와 혼동 금지.
 *        세율·공제율·기준액 숫자는 화면 어디에도 없다 — 판정은 전부 룰이 한다.
 */

import { useRef, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import SegmentControl from '@/components/common/SegmentControl'
import { REGIONS, findSigunguList } from '@/lib/tax/regions'
import { fullYearsBetween } from '@/lib/tax/period'
import type { TaxRuleMode } from '@/lib/tax/types'
import type { TransferHouseCount, TransferResult, TransferSuccess } from '@/lib/tax/transfer-types'
import type { YearComparison } from '@/lib/tax/year-comparison'
import RuleModeSelector from '../_components/RuleModeSelector'
import AdvancedFields from './AdvancedFields'
import { calculateTransfer } from './actions'
import CalcColumns, { CalcResultSlot, scrollResultIntoView } from '../_components/CalcColumns'
import TransferResultPanel from './TransferResultPanel'
import TransferComparisonCards from './TransferComparisonCards'

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
  // ── 룰 모드 — 기본값: 확정된 법 (취득세와 같은 전환 패턴) ──────────────────
  const [ruleMode, setRuleMode] = useState<TaxRuleMode>('confirmed')
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
  // 판정 근거 표시가 지금 입력칸이 아니라 그 결과를 만든 값을 가리키게 — 제출 시점 취득일
  const [submittedAcquiredAt, setSubmittedAcquiredAt] = useState('')
  const [result, setResult] = useState<TransferResult | null>(null)
  const [comparison, setComparison] = useState<YearComparison<TransferSuccess> | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const resultRef = useRef<HTMLDivElement>(null)

  /** 입력이 바뀌면 이전 결과를 지운다 — 바뀐 입력과 무관한 옛 결과가 화면에 남는 것을 방지 */
  function clearStaleResult() {
    if (result) setResult(null)
    if (comparison) setComparison(null)
  }

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
    // 취득 당시 조정대상지역은 비워 두면 서버가 이력으로 자동 판정한다(못 하면 사유와 함께 요청)
    // 미래 날짜 차단 — 양도일보다 뒤인 날짜는 판정을 왜곡한다 (엔진도 같은 검증으로 이중 방어)
    if (acquiredAt > transferDate) { setFormError('취득일이 양도일보다 늦을 수 없습니다.'); return }
    // 거주기간이 보유기간을 넘으면 차단 — 종부세 폼과 같은 취지, 엔진과 이중 방어.
    // 연수 계산은 엔진과 같은 공용 함수(period.ts)를 쓰되, 초일 산입 방식은 룰 값이라
    // 폼은 더 관대한 쪽(include_start)으로만 검사한다 — 경계·불산입 여부는 엔진이 판정한다.
    // 상속 주택은 공제용 기산일이 상속개시일이라 이 가드를 건너뛴다(엔진이 판정).
    if (resNum !== undefined && !inherited && acquiredAt &&
        resNum > fullYearsBetween(acquiredAt, transferDate, 'include_start')) {
      setFormError('거주기간이 보유기간보다 길 수 없습니다. 취득일·거주기간 입력을 확인해 주세요.'); return
    }
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
          ruleMode,
          transferDate,
          acquiredAt,
          sido,
          sigungu,
          transferPrice: priceNum,
          acquirePrice: acqNum,
          expenses: expNum,
          houseCount,
          // 전 주택 수에서 전달 — 다주택도 개정안(거주 기준) 장기보유특별공제 판정에 쓴다
          residenceYears: resNum,
          acquiredInRegulatedArea:
            oneHouseTrack && acquiredRegulated !== '' ? acquiredRegulated === 'yes' : undefined,
          isTemporaryTwoHouse: houseCount === 2 ? temporaryTwo : undefined,
          newHouseAcquiredAt: houseCount === 2 && temporaryTwo && newHouseAcquiredAt ? newHouseAcquiredAt : undefined,
          inherited,
          inheritanceOpenedAt: inherited && inheritanceOpenedAt ? inheritanceOpenedAt : undefined,
          decedentAcquiredAt: inherited && decedentAcquiredAt ? decedentAcquiredAt : undefined,
          graceContractDate: graceContractDate || undefined,
          graceDepositReceived: graceContractDate ? graceDeposit : undefined,
          includeYearComparison: true,
        })
        setResult(res.result)
        setSubmittedAcquiredAt(acquiredAt)
        setComparison(res.comparison ?? null)
        scrollResultIntoView(resultRef)
      } catch {
        setFormError('계산 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })
  }

  return (
    <>
    <CalcColumns>
      {/* onChange: 폼 안 어떤 입력이든 바뀌면 이전 결과를 지운다(버튼형 선택은 각 onChange에서) */}
      <form onSubmit={handleSubmit} onChange={clearStaleResult} className="bg-paper-raised border border-rule rounded-lg p-6 sm:p-8 space-y-5">
        {/* 룰 모드 — 기본값: 확정된 법 (취득세와 같은 전환 패턴, 공용 컴포넌트) */}
        <RuleModeSelector value={ruleMode} periodNoun="양도일"
          onChange={(m) => { setRuleMode(m); clearStaleResult() }} />

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
          onChange={(v) => { setHouseCount(v === '2' ? 2 : v === '3' ? 3 : 1); clearStaleResult() }}
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

        {/* 거주기간 — 전 주택 수 공통. 1주택은 비과세·큰 표 판정, 그 외에도 개정안(거주 기준)
            장기보유특별공제 판정에 쓰인다. 비워 두면 보유 기준 공제만 적용된다(0으로 간주 안 함) */}
        <Field label="거주기간 (만 연수)" htmlFor="tr-residence"
          hint="실제 거주한 만 연수. 1세대 1주택 판정과 장기보유특별공제(개정안의 거주 기준 공제 포함)에 쓰입니다. 비워 두면 거주 기준 공제 없이 계산합니다. 산정 방식(초일 산입)은 법령·집행기준에서 확인되지 않아 보유기간과 같은 방식을 전제로 합니다.">
          <Input id="tr-residence" type="number" min={0} step={1} value={residenceYears}
            onChange={(e) => setResidenceYears(e.target.value)} placeholder="예: 3" />
        </Field>

        {/* 1주택 트랙(1주택 또는 일시적 2주택) — 비과세·장기보유특별공제 큰 표 판정용 입력.
            취득 당시 조정대상지역은 등록된 이력으로 자동 판정하되, 직접 지정하면 그 값이 우선한다 */}
        {oneHouseTrack && (
          <div className="space-y-4 border-l-2 border-pen/20 pl-4">
            <Field label="취득 당시 조정대상지역 여부" htmlFor="tr-acq-regulated"
              hint="비워 두면 등록된 지정 이력으로 취득일 기준 자동 판정합니다(판정 결과와 근거를 결과에 표시합니다). 자동으로 판정할 수 없는 경우에는 이유와 함께 직접 선택을 요청합니다. 직접 선택하면 그 값이 자동 판정보다 우선합니다. 비과세 거주 요건 판정에만 쓰입니다.">
              <select id="tr-acq-regulated" className={SELECT_CLS} value={acquiredRegulated}
                onChange={(e) => setAcquiredRegulated(e.target.value as '' | 'yes' | 'no')}>
                <option value="">자동 판정 (권장)</option>
                <option value="yes">예 — 취득 당시 조정대상지역</option>
                <option value="no">아니요 — 취득 당시 비규제</option>
              </select>
            </Field>
          </div>
        )}

        {/* 고급 항목 — 기본 접힘 (표시는 AdvancedFields로 분리 — 상태는 이 폼이 소유) */}
        <AdvancedFields
          open={advancedOpen} onToggle={() => setAdvancedOpen((v) => !v)}
          expenses={expenses} onExpenses={setExpenses}
          inherited={inherited} onInherited={setInherited}
          inheritanceOpenedAt={inheritanceOpenedAt} onInheritanceOpenedAt={setInheritanceOpenedAt}
          decedentAcquiredAt={decedentAcquiredAt} onDecedentAcquiredAt={setDecedentAcquiredAt}
          graceContractDate={graceContractDate} onGraceContractDate={setGraceContractDate}
          graceDeposit={graceDeposit} onGraceDeposit={setGraceDeposit}
          graceDeadlineText={graceDeadlineText}
        />

        {formError && <p className="text-sm font-medium text-seal" role="alert">{formError}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? '계산 중…' : '양도소득세 계산하기'}
        </Button>
      </form>

      {/* 결과 — 넓은 화면은 오른쪽 열, 계산 전·소멸 시 자리표시 (CalcResultSlot) */}
      <CalcResultSlot>
      {result && (
        <div ref={resultRef} className="scroll-mt-24">
          <TransferResultPanel result={result} acquiredAt={submittedAcquiredAt} />
        </div>
      )}
      </CalcResultSlot>
    </CalcColumns>

    {/* 연도별 비교 — 2단 아래 통폭. 오른쪽 결과 열(≈620px)은 카드 4장을 담기에 좁아
        CalcColumns 밖(CalcSection 통폭)에 둔다. 비교가 없으면(요청 실패·본 계산 실패·
        비교 불성립) 아무것도 그리지 않는다 */}
    {comparison && <TransferComparisonCards comparison={comparison} />}
    </>
  )
}
