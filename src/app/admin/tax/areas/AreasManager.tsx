'use client'

/**
 * @컴포넌트: AreasManager
 * @설명: 규제지역 이력 목록 + 등록/수정 폼.
 *        소재지는 계산기(regions.ts)와 같은 목록에서만 선택 — 코드 불일치 방지.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, Pencil, Plus } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { REGIONS, findSigunguList } from '@/lib/tax/regions'
import { AREA_TYPES, AREA_TYPE_LABELS, TAX_TYPES, TAX_TYPE_LABELS } from '@/lib/tax/labels'
import type { RegulatedAreaType, TaxRegulatedArea, TaxType } from '@/lib/tax/types'
import { saveTaxArea } from './actions'

const SELECT_CLS =
  'w-full rounded-md border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink transition-colors focus:border-pen focus:ring-2 focus:ring-pen/15 focus:outline-none disabled:opacity-50'

/** applies_to 배열을 한국어로 표시 */
function appliesLabel(appliesTo: string[]): string {
  if (appliesTo.includes('all')) return '전 세목'
  return appliesTo.map((t) => TAX_TYPE_LABELS[t as TaxType] ?? t).join('·')
}

/** 규제지역 등록·수정 폼 */
function AreaForm({ initial, onDone }: { initial: TaxRegulatedArea | null; onDone: (saved: boolean) => void }) {
  const [sido, setSido] = useState(initial?.sido ?? '')
  const [sigungu, setSigungu] = useState(initial?.sigungu ?? '')
  const [areaType, setAreaType] = useState<RegulatedAreaType>(initial?.area_type ?? 'adjustment')
  const [appliesAll, setAppliesAll] = useState(initial ? initial.applies_to.includes('all') : true)
  const [appliesTo, setAppliesTo] = useState<TaxType[]>(
    initial ? (initial.applies_to.filter((t) => t !== 'all') as TaxType[]) : [],
  )
  const [designatedFrom, setDesignatedFrom] = useState(initial?.designated_from ?? '')
  const [designatedTo, setDesignatedTo] = useState(initial?.designated_to ?? '')
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sigunguList = sido ? (findSigunguList(sido) ?? []) : []

  function toggleTaxType(t: TaxType) {
    setAppliesTo((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!sido || !sigungu) { setError('소재지를 목록에서 선택해 주세요.'); return }
    if (!designatedFrom) { setError('지정일은 필수입니다.'); return }

    startTransition(async () => {
      const result = await saveTaxArea({
        id: initial?.id,
        sido,
        sigungu,
        area_type: areaType,
        appliesAll,
        appliesTo,
        designated_from: designatedFrom,
        designated_to: designatedTo || null,
        source_url: sourceUrl,
      })
      if (result.status === 'ok') onDone(true)
      else setError(result.reason)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-paper-raised border border-rule rounded-lg p-5 space-y-4">
      <h2 className="font-serif font-bold text-ink">{initial ? '규제지역 이력 수정' : '규제지역 이력 등록'}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="시·도" htmlFor="area-sido" required>
          <select id="area-sido" className={SELECT_CLS} value={sido}
            onChange={(e) => { setSido(e.target.value); setSigungu('') }}>
            <option value="">선택</option>
            {REGIONS.map((r) => <option key={r.sido} value={r.sido}>{r.sido}</option>)}
          </select>
        </Field>
        <Field label="시·군·구" htmlFor="area-sigungu" required>
          <select id="area-sigungu" className={SELECT_CLS} value={sigungu}
            onChange={(e) => setSigungu(e.target.value)} disabled={!sido}>
            <option value="">선택</option>
            {sigunguList.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="구분" htmlFor="area-type" required>
          <select id="area-type" className={SELECT_CLS} value={areaType}
            onChange={(e) => setAreaType(e.target.value as RegulatedAreaType)}>
            {AREA_TYPES.map((t) => <option key={t} value={t}>{AREA_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <Field label="적용 세목" htmlFor="area-applies" required
          hint="같은 지역이라도 세목마다 적용 시작일이 다르면 이력을 나눠 등록하세요.">
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={appliesAll}
                onChange={(e) => setAppliesAll(e.target.checked)} className="h-4 w-4 accent-pen" />
              전 세목 적용 (all)
            </label>
            {!appliesAll && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {TAX_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                    <input type="checkbox" checked={appliesTo.includes(t)}
                      onChange={() => toggleTaxType(t)} className="h-3.5 w-3.5 accent-pen" />
                    {TAX_TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            )}
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="지정일" htmlFor="area-from" required>
          <Input id="area-from" type="date" value={designatedFrom}
            onChange={(e) => setDesignatedFrom(e.target.value)} required />
        </Field>
        <Field label="해제일" htmlFor="area-to" hint="비우면 현재 지정 상태로 판정됩니다.">
          <Input id="area-to" type="date" value={designatedTo}
            onChange={(e) => setDesignatedTo(e.target.value)} />
        </Field>
      </div>

      <Field label="국토교통부 공고 링크" htmlFor="area-source" required
        hint="공고 근거 없는 이력은 저장할 수 없습니다.">
        <Input id="area-source" type="url" value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://www.molit.go.kr/..." required />
      </Field>

      {error && <p className="text-sm font-medium text-seal" role="alert">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 size={14} className="animate-spin" />}
          저장
        </Button>
        <Button variant="ghost" onClick={() => onDone(false)}>취소</Button>
      </div>
    </form>
  )
}

export default function AreasManager({ areas }: { areas: TaxRegulatedArea[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<TaxRegulatedArea | 'new' | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)

  function handleDone(saved: boolean) {
    setEditing(null)
    if (saved) {
      setSavedNotice(true)
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!editing && (
          <Button size="sm" onClick={() => { setSavedNotice(false); setEditing('new') }}>
            <Plus size={14} />
            이력 등록
          </Button>
        )}
      </div>

      {savedNotice && !editing && (
        <p className="text-sm text-ok bg-ok-soft border border-ok/25 rounded-md px-3 py-2">
          저장되었습니다. 계산기의 규제지역 판정에 즉시 사용됩니다.
        </p>
      )}

      {editing && <AreaForm initial={editing === 'new' ? null : editing} onDone={handleDone} />}

      {areas.length === 0 ? (
        <div className="bg-paper-raised border border-rule rounded-lg p-8 text-center text-sm text-ink-soft">
          등록된 규제지역 이력이 없습니다. 이력이 없으면 모든 지역이 비규제로 판정됩니다.
          국토교통부 공고를 근거로 직접 입력해 주세요.
        </div>
      ) : (
        <ul className="space-y-2">
          {areas.map((area) => (
            <li key={area.id} className="bg-paper-raised border border-rule rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink">{area.sido} {area.sigungu}</span>
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-info-soft text-info">
                      {AREA_TYPE_LABELS[area.area_type]}
                    </span>
                    {area.designated_to && (
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-paper-shade text-ink-faint">
                        해제됨
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft mt-1">
                    {area.designated_from} ~ {area.designated_to ?? '현재'}
                    <span className="mx-2 text-rule">|</span>
                    적용: {appliesLabel(area.applies_to)}
                    <span className="mx-2 text-rule">|</span>
                    <span className="font-mono">{area.region_code}</span>
                    <a href={area.source_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 ml-2 text-pen underline underline-offset-2 hover:text-pen-dark">
                      공고 <ExternalLink size={10} />
                    </a>
                  </p>
                </div>
                <button
                  onClick={() => { setSavedNotice(false); setEditing(area) }}
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
