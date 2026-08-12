'use client'

/**
 * @컴포넌트: RuleForm
 * @설명: 세금 룰 등록·수정 폼. 시행일·상태·법령명·조문·원문 링크는 필수이며,
 *        룰 키를 고르면 rule_value 입력 형식 안내(설명+스켈레톤)가 함께 표시된다.
 *        같은 룰 키에 기간이 겹치는 룰이 있으면 저장 전에 경고하고, 경고 확인 후
 *        한 번 더 눌러야 저장된다.
 */

import { useEffect, useState, useTransition } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { RULE_STATUSES, RULE_STATUS_LABELS, RULE_TAX_TYPES, RULE_TAX_TYPE_LABELS } from '@/lib/tax/labels'
import type { TaxRule, TaxRuleStatus, TaxRuleTaxType } from '@/lib/tax/types'
import { saveTaxRule } from './actions'
import { RULE_GUIDES, knownKeysForTaxType } from './rule-guides'

const SELECT_CLS =
  'w-full rounded-md border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink transition-colors focus:border-pen focus:ring-2 focus:ring-pen/15 focus:outline-none disabled:opacity-50'

interface Props {
  /** 수정 대상 룰 (신규면 null) */
  initial: TaxRule | null
  /** 겹침 경고 대조용 전체 룰 목록 */
  allRules: TaxRule[]
  /** 저장 완료·취소 시 호출 */
  onDone: (saved: boolean) => void
}

/** 두 기간(종료일 포함, null=무기한)이 겹치는지 검사 — ISO 날짜 문자열 비교 */
function periodsOverlap(fromA: string, toA: string | null, fromB: string, toB: string | null): boolean {
  return fromA <= (toB ?? '9999-12-31') && fromB <= (toA ?? '9999-12-31')
}

export default function RuleForm({ initial, allRules, onDone }: Props) {
  const [taxType, setTaxType] = useState<TaxRuleTaxType>(initial?.tax_type ?? 'acquisition')
  const initialKnownKeys = knownKeysForTaxType(initial?.tax_type ?? 'acquisition')
  const initialKnown = initial ? initialKnownKeys.includes(initial.rule_key) : true
  const [keyChoice, setKeyChoice] = useState<string>(
    initial ? (initialKnown ? initial.rule_key : '__custom') : initialKnownKeys[0] ?? '__custom',
  )
  const [customKey, setCustomKey] = useState(initial && !initialKnown ? initial.rule_key : '')
  const [status, setStatus] = useState<TaxRuleStatus>(initial?.status ?? 'confirmed')
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effective_from ?? '')
  const [effectiveTo, setEffectiveTo] = useState(initial?.effective_to ?? '')
  const [lawName, setLawName] = useState(initial?.law_name ?? '')
  const [lawArticle, setLawArticle] = useState(initial?.law_article ?? '')
  const [lawUrl, setLawUrl] = useState(initial?.law_url ?? '')
  const [lawId, setLawId] = useState(initial?.law_id ?? '')
  const [lawArticleNo, setLawArticleNo] = useState(initial?.law_article_no ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [valueText, setValueText] = useState(
    initial ? JSON.stringify(initial.rule_value, null, 2) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // 안내가 준비된 세목(취득세·공통)만 키 선택을 제공 — 그 외 세목은 직접 입력만 허용
  const knownKeys = knownKeysForTaxType(taxType)
  const usingCustom = knownKeys.length === 0 || keyChoice === '__custom'
  const ruleKey = usingCustom ? customKey.trim() : keyChoice
  const guide = !usingCustom ? RULE_GUIDES[keyChoice] : undefined

  // 입력이 바뀌면 이전 겹침 경고는 무효 — 다시 검사해야 한다
  const overlapDeps = `${taxType}|${ruleKey}|${effectiveFrom}|${effectiveTo}`
  useEffect(() => setOverlapWarning(null), [overlapDeps])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!ruleKey) { setError('룰 키를 입력해 주세요.'); return }
    if (!effectiveFrom) { setError('시행일은 필수입니다.'); return }
    if (!lawName.trim() || !lawArticle.trim() || !lawUrl.trim()) {
      setError('근거 법령명·조문·원문 링크는 필수입니다. 근거 없는 룰은 저장할 수 없습니다.')
      return
    }

    // ── 저장 전 겹침 경고 — 같은 룰 키에서 기간이 겹치는 기존 룰 검사 ────────
    if (!overlapWarning) {
      const clashing = allRules.filter(
        (r) =>
          r.id !== initial?.id &&
          r.tax_type === taxType &&
          r.rule_key === ruleKey &&
          periodsOverlap(effectiveFrom, effectiveTo || null, r.effective_from, r.effective_to),
      )
      if (clashing.length > 0) {
        const list = clashing
          .map((r) => `[${RULE_STATUS_LABELS[r.status]}] ${r.effective_from} ~ ${r.effective_to ?? '현재'}`)
          .join(' / ')
        setOverlapWarning(
          `같은 룰 키('${ruleKey}')에 기간이 겹치는 룰이 ${clashing.length}건 있습니다: ${list}. ` +
            '같은 상태끼리 겹치면 저장이 거부되고, 상태가 달라도 의도한 병행 등록인지 확인이 필요합니다. ' +
            '문제없다면 저장 버튼을 한 번 더 눌러 주세요.',
        )
        return
      }
    }

    startTransition(async () => {
      const result = await saveTaxRule({
        id: initial?.id,
        tax_type: taxType,
        rule_key: ruleKey,
        rule_value_text: valueText,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        status,
        law_name: lawName,
        law_article: lawArticle,
        law_url: lawUrl,
        law_id: lawId.trim() || null,
        law_article_no: lawArticleNo.trim() || null,
        note: note || null,
      })
      if (result.status === 'ok') onDone(true)
      else setError(result.reason)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-paper-raised border border-rule rounded-lg p-5 space-y-4">
      <h2 className="font-serif font-bold text-ink">{initial ? '룰 수정' : '새 룰 등록'}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="세목" htmlFor="rule-tax-type" required>
          <select id="rule-tax-type" className={SELECT_CLS} value={taxType}
            onChange={(e) => {
              const t = e.target.value as TaxRuleTaxType
              setTaxType(t)
              // 새 세목에 안내가 있으면 첫 키를 기본 선택, 없으면 직접 입력으로
              setKeyChoice(knownKeysForTaxType(t)[0] ?? '__custom')
            }}>
            {RULE_TAX_TYPES.map((t) => <option key={t} value={t}>{RULE_TAX_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <Field label="상태" htmlFor="rule-status" required
          hint="개정안(proposed)은 확정법 모드 계산에서 제외됩니다.">
          <select id="rule-status" className={SELECT_CLS} value={status}
            onChange={(e) => setStatus(e.target.value as TaxRuleStatus)}>
            {RULE_STATUSES.map((s) => <option key={s} value={s}>{RULE_STATUS_LABELS[s]}</option>)}
          </select>
        </Field>
      </div>

      <Field label="룰 키" htmlFor="rule-key" required>
        {knownKeys.length > 0 ? (
          <select id="rule-key" className={SELECT_CLS} value={keyChoice}
            onChange={(e) => setKeyChoice(e.target.value)}>
            {knownKeys.map((k) => <option key={k} value={k}>{k}</option>)}
            <option value="__custom">직접 입력</option>
          </select>
        ) : (
          <Input id="rule-key" value={customKey} onChange={(e) => setCustomKey(e.target.value)}
            placeholder="예: transfer.basic_rates" />
        )}
        {knownKeys.length > 0 && keyChoice === '__custom' && (
          <Input className="mt-2" value={customKey} onChange={(e) => setCustomKey(e.target.value)}
            placeholder="룰 키 직접 입력" />
        )}
      </Field>

      {/* 룰 키별 입력 형식 안내 */}
      {guide && (
        <div className="bg-info-soft border border-info/25 rounded-md p-4 text-xs leading-relaxed">
          <p className="font-semibold text-info mb-1.5">{guide.title}</p>
          <ul className="list-disc pl-4 space-y-1 text-ink-soft">
            {guide.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
          <p className="mt-2 mb-1 font-semibold text-ink">입력 형식 («...»는 법령 확인 후 실제 값으로 교체):</p>
          <pre className="bg-paper border border-rule rounded p-3 overflow-x-auto font-mono text-[11px] text-ink">{guide.skeleton}</pre>
        </div>
      )}

      <Field label="룰 값 (rule_value JSON)" htmlFor="rule-value" required
        hint="위 형식 안내대로 입력하세요. 저장 시 JSON·스키마를 검증합니다.">
        <Textarea id="rule-value" value={valueText} onChange={(e) => setValueText(e.target.value)}
          className="font-mono text-xs min-h-44" placeholder={guide ? guide.skeleton : '{ ... }'} required />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="시행일" htmlFor="rule-from" required>
          <Input id="rule-from" type="date" value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)} required />
        </Field>
        <Field label="종료일" htmlFor="rule-to" hint="비우면 무기한 유효(현재 적용 중).">
          <Input id="rule-to" type="date" value={effectiveTo}
            onChange={(e) => setEffectiveTo(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="근거 법령명" htmlFor="rule-law-name" required>
          <Input id="rule-law-name" value={lawName} onChange={(e) => setLawName(e.target.value)}
            placeholder="예: 지방세법" required />
        </Field>
        <Field label="근거 조문" htmlFor="rule-law-article" required>
          <Input id="rule-law-article" value={lawArticle} onChange={(e) => setLawArticle(e.target.value)}
            placeholder="예: 제11조제1항제8호" required />
        </Field>
      </div>

      <Field label="법제처 원문 링크" htmlFor="rule-law-url" required>
        <Input id="rule-law-url" type="url" value={lawUrl} onChange={(e) => setLawUrl(e.target.value)}
          placeholder="https://law.go.kr/..." required />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="법제처 법령 ID" htmlFor="rule-law-id"
          hint="법령 개정 자동 감시에 사용됩니다. 모르면 비워두세요.">
          <Input id="rule-law-id" value={lawId} onChange={(e) => setLawId(e.target.value)}
            placeholder="법제처 법령 ID" />
        </Field>
        <Field label="조문번호 (법제처 6자리)" htmlFor="rule-law-article-no"
          hint="조번호 4자리 + 가지번호 2자리. 모르면 비워두세요.">
          <Input id="rule-law-article-no" value={lawArticleNo} onChange={(e) => setLawArticleNo(e.target.value)}
            placeholder="숫자 6자리" inputMode="numeric" maxLength={6} />
        </Field>
      </div>

      <Field label="메모" htmlFor="rule-note">
        <Textarea id="rule-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
      </Field>

      {overlapWarning && (
        <p className="flex items-start gap-2 text-sm text-caution bg-caution-soft border border-caution/30 rounded-md p-3" role="alert">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {overlapWarning}
        </p>
      )}
      {error && <p className="text-sm font-medium text-seal" role="alert">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 size={14} className="animate-spin" />}
          {overlapWarning ? '경고 확인 — 그래도 저장' : '저장'}
        </Button>
        <Button variant="ghost" onClick={() => onDone(false)}>취소</Button>
      </div>
    </form>
  )
}
