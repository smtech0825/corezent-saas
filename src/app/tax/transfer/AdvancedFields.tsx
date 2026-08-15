'use client'

/**
 * @파일: tax/transfer/AdvancedFields.tsx
 * @설명: 양도소득세 폼의 고급 항목(기본 접힘 — 필요경비·상속 관련 날짜·다주택 중과
 *        경과조치) 표시 블록 — TransferForm의 300줄 규칙 준수를 위해 분리했다
 *        (종부세 ProposedFields와 대칭). 상태는 폼이 소유하고 여기는 표시만 담당한다.
 */

import { ChevronDown } from 'lucide-react'
import { Field, Input } from '@/components/ui/Input'

/** 숫자 미리보기 한 줄 (폼과 동일 — 파일 분리로 인한 소형 중복) */
function WonPreview({ value }: { value: string }) {
  if (value === '' || Number.isNaN(Number(value))) return null
  return <p className="text-xs text-ink-faint mt-1">{Number(value).toLocaleString('ko-KR')}원</p>
}

/** 체크박스 한 줄 (폼과 동일 — 파일 분리로 인한 소형 중복) */
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

export default function AdvancedFields({
  open, onToggle, expenses, onExpenses, inherited, onInherited,
  inheritanceOpenedAt, onInheritanceOpenedAt, decedentAcquiredAt, onDecedentAcquiredAt,
  graceContractDate, onGraceContractDate, graceDeposit, onGraceDeposit, graceDeadlineText,
}: {
  open: boolean; onToggle: () => void
  expenses: string; onExpenses: (v: string) => void
  inherited: boolean; onInherited: (v: boolean) => void
  inheritanceOpenedAt: string; onInheritanceOpenedAt: (v: string) => void
  decedentAcquiredAt: string; onDecedentAcquiredAt: (v: string) => void
  graceContractDate: string; onGraceContractDate: (v: string) => void
  graceDeposit: boolean; onGraceDeposit: (v: boolean) => void
  /** 중과 경과조치 계약 마감일 안내 문구 — 서버가 heavy 룰에서 읽어 넘긴다. 없으면 일반 문구 */
  graceDeadlineText?: string | null
}) {
  return (
    <div className="border-t border-rule pt-4">
      <button type="button" onClick={onToggle}
        className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink transition-colors">
        고급 항목
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <Field label="필요경비 (원)" htmlFor="tr-expenses"
            hint="취득세·중개수수료·자본적지출 등. 비우면 0으로 계산하며, 실제 세금은 이보다 낮을 수 있습니다.">
            <Input id="tr-expenses" type="number" min={0} step={1} value={expenses}
              onChange={(e) => onExpenses(e.target.value)} placeholder="예: 20000000" />
            <WonPreview value={expenses} />
          </Field>

          <CheckRow label="상속받은 주택" hint="보유기간 기산일이 달라집니다 — 세율용은 피상속인 취득일, 공제용은 상속개시일."
            checked={inherited} onChange={onInherited} />
          {inherited && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="상속개시일" htmlFor="tr-inherit-open" required>
                <Input id="tr-inherit-open" type="date" value={inheritanceOpenedAt}
                  onChange={(e) => onInheritanceOpenedAt(e.target.value)} required />
              </Field>
              <Field label="피상속인 취득일" htmlFor="tr-decedent" required>
                <Input id="tr-decedent" type="date" value={decedentAcquiredAt}
                  onChange={(e) => onDecedentAcquiredAt(e.target.value)} required />
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
                onChange={(e) => onGraceContractDate(e.target.value)} />
            </Field>
            {graceContractDate && (
              <CheckRow label="계약금을 받았습니다" checked={graceDeposit} onChange={onGraceDeposit} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
