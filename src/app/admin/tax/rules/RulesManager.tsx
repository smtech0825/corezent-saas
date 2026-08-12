'use client'

/**
 * @컴포넌트: RulesManager
 * @설명: 세금 룰 목록(세목 필터·시행일 순) + 등록/수정 폼 전환.
 *        저장 성공 시 router.refresh()로 서버 목록을 다시 불러온다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Pencil, Plus } from 'lucide-react'
import Button from '@/components/ui/Button'
import { RULE_STATUS_LABELS, RULE_TAX_TYPES, RULE_TAX_TYPE_LABELS } from '@/lib/tax/labels'
import type { TaxRule, TaxRuleTaxType } from '@/lib/tax/types'
import RuleForm from './RuleForm'

/** 상태 뱃지 색상 클래스 */
const STATUS_BADGE: Record<TaxRule['status'], string> = {
  confirmed: 'bg-ok-soft text-ok',
  proposed: 'bg-caution-soft text-caution',
  repealed: 'bg-paper-shade text-ink-faint',
}

export default function RulesManager({ rules }: { rules: TaxRule[] }) {
  const router = useRouter()
  const [taxType, setTaxType] = useState<TaxRuleTaxType>('acquisition')
  const [editing, setEditing] = useState<TaxRule | 'new' | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)

  const filtered = rules.filter((r) => r.tax_type === taxType)

  function handleDone(saved: boolean) {
    setEditing(null)
    if (saved) {
      setSavedNotice(true)
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      {/* 세목 필터 + 새 룰 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {RULE_TAX_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => { setTaxType(t); setEditing(null) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                taxType === t ? 'bg-mark text-white' : 'bg-paper-shade text-ink-soft hover:text-ink'
              }`}
            >
              {RULE_TAX_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        {!editing && (
          <Button size="sm" onClick={() => { setSavedNotice(false); setEditing('new') }}>
            <Plus size={14} />
            새 룰 등록
          </Button>
        )}
      </div>

      {savedNotice && !editing && (
        <p className="text-sm text-ok bg-ok-soft border border-ok/25 rounded-md px-3 py-2">
          저장되었습니다. 계산기에는 시행일·상태 조건을 만족할 때 반영됩니다.
        </p>
      )}

      {editing && (
        <RuleForm
          // key가 없으면 폼이 열린 채 다른 룰의 '수정'을 눌러도 입력값이 이전 룰
          // 그대로 남아, 저장 시 다른 룰을 이전 값으로 덮어쓴다 — key로 강제 리마운트
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          allRules={rules}
          onDone={handleDone}
        />
      )}

      {/* 목록 — 시행일 순 */}
      {filtered.length === 0 ? (
        <div className="bg-paper-raised border border-rule rounded-lg p-8 text-center text-sm text-ink-soft">
          {RULE_TAX_TYPE_LABELS[taxType]} 룰이 아직 없습니다.{' '}
          {taxType === 'common'
            ? '공통 룰(수도권 범위 등)이 없으면 그 조건을 쓰는 세율 행은 판정되지 않습니다.'
            : '룰이 등록될 때까지 이 세목의 계산은 제공되지 않습니다(0원으로 계산되지 않습니다).'}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((rule) => (
            <li key={rule.id} className="bg-paper-raised border border-rule rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-ink">{rule.rule_key}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${STATUS_BADGE[rule.status]}`}>
                      {RULE_STATUS_LABELS[rule.status]}
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft mt-1">
                    시행 {rule.effective_from} ~ {rule.effective_to ?? '현재'}
                    <span className="mx-2 text-rule">|</span>
                    {rule.law_name} {rule.law_article}
                    <a href={rule.law_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 ml-2 text-pen underline underline-offset-2 hover:text-pen-dark">
                      원문 <ExternalLink size={10} />
                    </a>
                  </p>
                  {rule.note && <p className="text-xs text-ink-faint mt-1">{rule.note}</p>}
                </div>
                <button
                  onClick={() => { setSavedNotice(false); setEditing(rule) }}
                  className="flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink border border-rule rounded-md px-2.5 py-1.5 transition-colors"
                >
                  <Pencil size={12} />
                  수정
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
