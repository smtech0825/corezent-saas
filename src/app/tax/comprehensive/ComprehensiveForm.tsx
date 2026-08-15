'use client'

/**
 * @컴포넌트: ComprehensiveForm
 * @설명: 종합부동산세 계산기 입력 폼 — 입력을 늘리지 않는 대원칙.
 *        - 항상: 과세연도·보유 주택 수·공시가격 합계·(주택 수 1일 때) 1세대 1주택 여부
 *        - 1세대 1주택 선택 시: 나이(만)·보유기간(만 연수) — 세액공제 판정에 필수
 *        - 고급(접힘): 직전 연도 총세액 — 비우면 세부담 상한 미적용(안내 부착)
 *        - 개정안 모드 전용(2026 세제개편안 — 확정법 모드에서는 숨김): 거주 여부(1주택),
 *          거주기간(1주택, 보유기간과 나란히), 거주 중인 주택의 공시가격(다주택 — 비거주면 0),
 *          조정대상지역 주택 보유 여부(자기신고 — 주소를 받지 않아 자동 판정 불가)
 *        주택을 한 채씩 등록하는 목록 입력은 만들지 않는다 — 인별 합산 세목이라
 *        주택 수와 공시가격 합계면 계산된다.
 *        세율·공제액·기준액 숫자는 화면 어디에도 없다 — 판정은 전부 룰이 한다.
 */

import { useRef, useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import SegmentControl from '@/components/common/SegmentControl'
import type { TaxRuleMode } from '@/lib/tax/types'
import type { ComprehensiveHouseCount, ComprehensiveResult } from '@/lib/tax/comprehensive-types'
import { calculateComprehensive } from './actions'
import ComprehensiveResultPanel from './ComprehensiveResultPanel'

/** Input과 톤을 맞춘 select 클래스 (다른 계산기 폼과 동일 — 파일 분리로 인한 소형 중복) */
const SELECT_CLS =
  'w-full rounded-md border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink transition-colors focus:border-pen focus:ring-2 focus:ring-pen/15 focus:outline-none disabled:opacity-50'

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

export default function ComprehensiveForm() {
  // ── 기본 입력 ──────────────────────────────────────────────────────────────
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()))
  const [houseCount, setHouseCount] = useState<ComprehensiveHouseCount>(1)
  const [totalPrice, setTotalPrice] = useState('')
  const [isOneHouse, setIsOneHouse] = useState(false)
  // ── 1세대 1주택 조건부 입력 ────────────────────────────────────────────────
  const [age, setAge] = useState('')
  const [holdingYears, setHoldingYears] = useState('')
  // ── 룰 모드 — 기본값: 확정된 법 (취득세와 같은 전환 패턴). 개정안 모드에서만
  //    아래 개정안 전용 입력 4종이 화면에 나타난다.
  const [ruleMode, setRuleMode] = useState<TaxRuleMode>('confirmed')
  const proposedMode = ruleMode === 'proposed'
  // ── 개정안 모드 전용 입력 (2026 세제개편안 — 확정법 계산에는 쓰이지 않아 숨김) ──
  const [isResiding, setIsResiding] = useState<'' | 'yes' | 'no'>('')      // 1주택 — 거주 여부 (명시 선택)
  const [residenceYears, setResidenceYears] = useState('')                 // 1주택 — 거주기간 (만 연수)
  const [residingPrice, setResidingPrice] = useState('')                   // 다주택 — 거주 주택 공시가격
  const [hasRegulated, setHasRegulated] = useState<'' | 'yes' | 'no'>('')  // 조정 보유 — 자기신고
  // ── 고급 입력 (기본 접힘) ──────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [prevTotalTax, setPrevTotalTax] = useState('')
  // ── 결과 ──────────────────────────────────────────────────────────────────
  // 계산 과정 표시에 제출 시점의 공시가격 합계가 필요해 결과와 함께 보관한다
  // (입력을 바꿔도 이미 표시된 결과가 흔들리지 않게 — 결과·입력 쌍을 함께 저장)
  const [submitted, setSubmitted] = useState<{ result: ComprehensiveResult; totalOfficialPrice: number } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const resultRef = useRef<HTMLDivElement>(null)

  /** 입력이 바뀌면 이전 결과를 지운다 — 바뀐 입력과 무관한 옛 결과가 화면에 남는 것을 방지 */
  function clearStaleResult() {
    if (submitted) setSubmitted(null)
  }

  // 1세대 1주택은 보유 주택 수 1일 때만 의미가 있다 — 주택 수를 바꾸면 입력을 숨기고 무시한다
  const oneHouseTrack = houseCount === 1 && isOneHouse

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
    const priceNum = toNum(totalPrice)
    if (priceNum === undefined || Number.isNaN(priceNum) || priceNum <= 0) {
      setFormError('공시가격 합계를 0보다 큰 숫자로 입력해 주세요.'); return
    }
    let ageNum: number | undefined
    let holdingNum: number | undefined
    if (oneHouseTrack) {
      ageNum = toNum(age)
      if (ageNum === undefined || Number.isNaN(ageNum) || ageNum < 0) {
        setFormError('1세대 1주택 세액공제 판정에는 나이(만 나이)를 입력해야 합니다.'); return
      }
      holdingNum = toNum(holdingYears)
      if (holdingNum === undefined || Number.isNaN(holdingNum) || holdingNum < 0) {
        setFormError('1세대 1주택 세액공제 판정에는 보유기간(만 연수)을 입력해야 합니다.'); return
      }
    }
    const prevNum = toNum(prevTotalTax)
    if (prevNum !== undefined && (Number.isNaN(prevNum) || prevNum < 0)) {
      setFormError('직전 연도 총세액을 0 이상 숫자로 입력해 주세요.'); return
    }
    // ── 개정안 모드 전용 검증 — 확정법 모드에서는 받지 않는 값이라 검사하지 않는다 ──
    let residenceNum: number | undefined
    let residingPriceNum: number | undefined
    if (proposedMode) {
      if (hasRegulated === '') {
        setFormError('조정대상지역 내 주택 보유 여부를 선택해 주세요. 주소를 받지 않아 자동으로 판정할 수 없습니다.'); return
      }
      if (oneHouseTrack) {
        if (isResiding === '') {
          setFormError('이 주택에 현재 거주 중인지 선택해 주세요. 개정안 기본공제 판정에 필요합니다.'); return
        }
        residenceNum = toNum(residenceYears)
        if (residenceNum === undefined || Number.isNaN(residenceNum) || residenceNum < 0) {
          setFormError('개정안 세액공제 판정에는 거주기간(만 연수)을 입력해야 합니다.'); return
        }
        if (holdingNum !== undefined && residenceNum > holdingNum) {
          setFormError('거주기간이 보유기간보다 길 수 없습니다. 입력을 확인해 주세요.'); return
        }
      }
      if (houseCount >= 2) {
        residingPriceNum = toNum(residingPrice)
        if (residingPriceNum === undefined || Number.isNaN(residingPriceNum) || residingPriceNum < 0) {
          setFormError('현재 거주 중인 주택의 공시가격을 입력해 주세요. 거주하지 않으면 0을 입력합니다.'); return
        }
        if (residingPriceNum > priceNum) {
          setFormError('현재 거주 중인 주택의 공시가격이 공시가격 합계를 넘을 수 없습니다.'); return
        }
      }
    }

    startTransition(async () => {
      try {
        const res = await calculateComprehensive({
          ruleMode,
          taxYear: yearNum,
          houseCount,
          totalOfficialPrice: priceNum,
          isOneHouse: oneHouseTrack,
          age: oneHouseTrack ? ageNum : undefined,
          holdingYears: oneHouseTrack ? holdingNum : undefined,
          prevTotalTax: prevNum,
          // 개정안 모드 전용 — 확정법 모드에서는 보내지 않는다(엔진도 그때만 요구)
          residenceYears: proposedMode && oneHouseTrack ? residenceNum : undefined,
          isResiding: proposedMode && oneHouseTrack ? isResiding === 'yes' : undefined,
          residingOfficialPrice: proposedMode && houseCount >= 2 ? residingPriceNum : undefined,
          hasRegulatedHouse: proposedMode && hasRegulated !== '' ? hasRegulated === 'yes' : undefined,
        })
        setSubmitted({ result: res, totalOfficialPrice: priceNum })
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      } catch {
        setFormError('계산 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* onChange: 폼 안 어떤 입력이든 바뀌면 이전 결과를 지운다(버튼형 선택은 각 onChange에서) */}
      <form onSubmit={handleSubmit} onChange={clearStaleResult} className="bg-paper-raised border border-rule rounded-lg p-6 sm:p-8 space-y-5">
        {/* 룰 모드 — 기본값: 확정된 법 (취득세와 같은 전환 패턴) */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <SegmentControl
            label="계산 기준"
            value={ruleMode}
            onChange={(v) => { setRuleMode(v === 'proposed' ? 'proposed' : 'confirmed'); clearStaleResult() }}
            options={[
              { value: 'confirmed', label: '확정된 법 기준' },
              { value: 'proposed', label: '개정안 포함' },
            ]}
          />
          {proposedMode && (
            <p className="text-xs text-caution font-medium max-w-72 leading-relaxed">
              개정안은 아직 국회 통과 전이라 확정이 아닙니다. 항목별 시행 시점이
              2027·2028·2029년으로 나뉘어 과세연도에 따라 적용이 달라집니다.
              결과에 경고가 함께 표시됩니다.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="과세연도" htmlFor="cp-year" required
            hint="세금을 계산할 연도입니다. 과세기준일은 등록된 룰로 자동 판정됩니다.">
            <Input id="cp-year" type="number" step={1} value={taxYear}
              onChange={(e) => setTaxYear(e.target.value)} required />
          </Field>
          <Field label="공시가격 합계 (원)" htmlFor="cp-price" required
            hint="본인 명의 주택 전체의 공시가격을 더한 금액. 채별 입력은 필요 없습니다.">
            <Input id="cp-price" type="number" min={0} step={1} value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)} placeholder="예: 1500000000" required />
            <WonPreview value={totalPrice} />
          </Field>
        </div>

        <SegmentControl
          label="보유 주택 수 (본인 명의)"
          value={String(houseCount)}
          onChange={(v) => { setHouseCount(v === '2' ? 2 : v === '3' ? 3 : 1); clearStaleResult() }}
          options={[
            { value: '1', label: '1주택' },
            { value: '2', label: '2주택' },
            { value: '3', label: '3주택 이상' },
          ]}
        />

        {/* 1세대 1주택 — 주택 수 1일 때만 (세대 기준이라 별도 확인) */}
        {houseCount === 1 && (
          <div className="space-y-4 border-l-2 border-pen/20 pl-4">
            <CheckRow label="1세대 1주택입니다 (단독명의)"
              hint="세대 전체가 주택 1채만 보유한 단독명의 기준. 기본공제·세액공제 특례 판정에 쓰입니다. 부부 공동명의 특례는 반영되지 않습니다."
              checked={isOneHouse} onChange={setIsOneHouse} />
            {isOneHouse && (
              <>
                {/* 개정안 모드 — 거주 여부 (기본공제가 거주/비거주로 갈린다). 명시 선택을 요구한다 */}
                {proposedMode && (
                  <Field label="이 주택에 현재 거주 중인지" htmlFor="cp-residing" required
                    hint="개정안 기본공제는 거주 여부로 갈립니다 — 실제 거주 기준으로 선택하세요.">
                    <select id="cp-residing" className={SELECT_CLS} value={isResiding}
                      onChange={(e) => setIsResiding(e.target.value as '' | 'yes' | 'no')}>
                      <option value="">선택</option>
                      <option value="yes">예 — 이 주택에 거주 중</option>
                      <option value="no">아니요 — 거주하지 않음</option>
                    </select>
                  </Field>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="나이 (만 나이)" htmlFor="cp-age" required
                    hint="과세기준일 현재 만 나이 — 연령 세액공제 판정용.">
                    <Input id="cp-age" type="number" min={0} step={1} value={age}
                      onChange={(e) => setAge(e.target.value)} placeholder="예: 65" required />
                  </Field>
                  <Field label="보유기간 (만 연수)" htmlFor="cp-holding" required
                    hint={proposedMode
                      ? '해당 주택을 보유한 만 연수 — 확정법(보유 기준) 세액공제 판정용.'
                      : '해당 주택을 보유한 만 연수 — 보유기간 세액공제 판정용.'}>
                    <Input id="cp-holding" type="number" min={0} step={1} value={holdingYears}
                      onChange={(e) => setHoldingYears(e.target.value)} placeholder="예: 7" required />
                  </Field>
                  {/* 개정안 모드 — 거주기간. 보유기간과 나란히 두어 확정법=보유·개정안=거주 구분을 보여준다 */}
                  {proposedMode && (
                    <Field label="거주기간 (만 연수)" htmlFor="cp-residence" required
                      hint="해당 주택에 실제 거주한 만 연수 — 개정안(거주 기준) 세액공제 판정용. 확정법 계산에는 쓰이지 않습니다.">
                      <Input id="cp-residence" type="number" min={0} step={1} value={residenceYears}
                        onChange={(e) => setResidenceYears(e.target.value)} placeholder="예: 5" required />
                    </Field>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* 개정안 모드 — 다주택 기본공제 산식용: 거주 중인 주택의 공시가격 (비거주면 0) */}
        {proposedMode && houseCount >= 2 && (
          <div className="space-y-4 border-l-2 border-pen/20 pl-4">
            <Field label="현재 거주 중인 주택의 공시가격 (원)" htmlFor="cp-residing-price" required
              hint="개정안 다주택 기본공제 산식에 쓰입니다 — 거주 중인 주택의 공시가격 비중이 공제에 반영됩니다. 보유 주택 어디에도 거주하지 않으면 0을 입력하세요.">
              <Input id="cp-residing-price" type="number" min={0} step={1} value={residingPrice}
                onChange={(e) => setResidingPrice(e.target.value)} placeholder="예: 800000000" required />
              <WonPreview value={residingPrice} />
            </Field>
          </div>
        )}

        {/* 개정안 모드 — 조정대상지역 주택 보유 여부 (자기신고 — 주소를 받지 않아 자동 판정 불가) */}
        {proposedMode && (
          <Field label="조정대상지역 내 주택 보유 여부" htmlFor="cp-regulated" required
            hint="개정안 공정시장가액비율 등의 판정에 쓰입니다. 이 계산기는 주택 주소를 받지 않아 지정 여부를 자동으로 판정할 수 없습니다 — 보유 주택 중 한 채라도 조정대상지역에 있으면 '예'를 선택하세요. 지정 현황은 국토교통부 공고에서 확인할 수 있습니다.">
            <select id="cp-regulated" className={SELECT_CLS} value={hasRegulated}
              onChange={(e) => setHasRegulated(e.target.value as '' | 'yes' | 'no')}>
              <option value="">선택</option>
              <option value="yes">예 — 조정대상지역 주택 보유</option>
              <option value="no">아니요 — 없음</option>
            </select>
          </Field>
        )}

        {/* 고급 항목 — 기본 접힘. 직전 연도 총세액은 세부담 상한 판정용 */}
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
              <Field label="직전 연도 총세액 (원)" htmlFor="cp-prev"
                hint="작년에 이 주택(들)에 부과된 재산세와 종합부동산세를 더한 금액. 입력하면 세부담 상한이 적용됩니다. 작년 부과가 없었다면 0 대신 비워 두세요.">
                <Input id="cp-prev" type="number" min={0} step={1} value={prevTotalTax}
                  onChange={(e) => setPrevTotalTax(e.target.value)} placeholder="예: 3000000" />
                <WonPreview value={prevTotalTax} />
              </Field>
            </div>
          )}
        </div>

        {formError && <p className="text-sm font-medium text-seal" role="alert">{formError}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? '계산 중…' : '종합부동산세 계산하기'}
        </Button>
      </form>

      {/* 결과 */}
      {submitted && (
        <div ref={resultRef} className="scroll-mt-24">
          <ComprehensiveResultPanel result={submitted.result} totalOfficialPrice={submitted.totalOfficialPrice} />
        </div>
      )}
    </div>
  )
}
