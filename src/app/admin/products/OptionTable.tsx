'use client'

/**
 * @컴포넌트: OptionTable
 * @설명: 상품 옵션(가격) 목록을 표(1행=1옵션)로 편집. 8개 옵션이 한 화면에 보이도록 밀도 높게 배치.
 *        열: 순서 | 축1(기간) | 축2(PC개수) | 유형 | 주기 | 가격 | tier | Variant ID | Checkout URL | 삭제
 *        - 같은 상품 안에서 Variant ID·Checkout URL이 다른 행과 중복이면 셀을 경고색으로 표시(저장 검증과 결합).
 *        - Checkout URL은 끝 8자만 보여주고 복사, 클릭 시 전체 편집. 가격은 콤마 표시(포커스 시 원본).
 *        - 관리자 데스크톱 전제: 좁으면 가로 스크롤.
 */

import { useState } from 'react'
import { Plus, Trash2, Copy, Check } from 'lucide-react'
import type { PriceEntry } from './ProductForm'

interface Props {
  prices: PriceEntry[]
  axis1Name: string
  axis2Name: string
  onAdd: () => void
  onUpdate: (idx: number, key: keyof PriceEntry, value: string) => void
  onRemove: (idx: number) => void
}

const cellInput =
  'w-full bg-paper border border-rule text-ink text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-mark placeholder:text-ink-faint'
// 열 폭 — 내용 길이에 맞춤(순서 48 · 축 110 · 유형/주기 92 · 가격 110 · tier 80 · variant 110 · URL 유동)
const GRID = 'grid-cols-[48px_110px_110px_92px_92px_110px_80px_110px_minmax(180px,1fr)_40px]'
const dupCell = 'bg-caution-soft border-caution'

/**
 * @함수명: PriceInput
 * @설명: 가격 셀 — 포커스 시 원본 숫자, 벗어나면 천단위 콤마로 표시. 저장 값은 숫자 문자열만.
 */
function PriceInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false)
  const display = focused
    ? value
    : value && /^\d+$/.test(value)
      ? Number(value).toLocaleString('ko-KR')
      : value
  return (
    <input
      inputMode="numeric"
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      placeholder="0"
      className={`${cellInput} text-right tabular-nums`}
    />
  )
}

/**
 * @함수명: UrlCell
 * @설명: Checkout URL 셀 — 평소엔 끝 8자 + 복사, 클릭하면 전체 편집 input으로 전환.
 */
function UrlCell({ value, dup, onChange }: { value: string; dup: boolean; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        placeholder="https://corezent.lemonsqueezy.com/checkout/buy/..."
        className={`${cellInput} font-mono ${dup ? dupCell : ''}`}
      />
    )
  }

  const trimmed = value.trim()
  const tail = trimmed ? `…${trimmed.slice(-8)}` : ''

  return (
    <div className={`flex items-center gap-1 rounded-md border px-2 py-1.5 ${dup ? dupCell : 'border-rule bg-paper'}`}>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={trimmed || '클릭해 URL 입력'}
        className="flex-1 text-left text-xs font-mono text-ink truncate min-w-0"
      >
        {tail || <span className="text-ink-faint">클릭해 입력</span>}
      </button>
      {trimmed && (
        <button
          type="button"
          title="URL 복사"
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="shrink-0 text-ink-faint hover:text-mark transition-colors"
        >
          {copied ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
        </button>
      )}
    </div>
  )
}

/**
 * @함수명: OptionTable
 * @설명: 옵션 행 배열을 표로 렌더하고 추가/수정/삭제 콜백을 위임한다. 중복 감지는 이 컴포넌트에서 계산.
 */
export default function OptionTable({ prices, axis1Name, axis2Name, onAdd, onUpdate, onRemove }: Props) {
  // 중복 감지 — 같은 상품 내 Variant ID·Checkout URL이 2행 이상 등장하면 경고색
  const variantCounts = new Map<string, number>()
  const urlCounts = new Map<string, number>()
  prices.forEach((p) => {
    const v = p.lemon_squeezy_variant_id.trim()
    if (v) variantCounts.set(v, (variantCounts.get(v) ?? 0) + 1)
    const u = p.checkout_url.trim()
    if (u) urlCounts.set(u, (urlCounts.get(u) ?? 0) + 1)
  })
  const dupVariant = (v: string) => { const t = v.trim(); return !!t && (variantCounts.get(t) ?? 0) > 1 }
  const dupUrl = (u: string) => { const t = u.trim(); return !!t && (urlCounts.get(t) ?? 0) > 1 }
  const hasDup = [...variantCounts.values(), ...urlCounts.values()].some((n) => n > 1)

  return (
    <div className="space-y-3">
      {/* 헤더 + 추가 버튼 */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">② 옵션 목록</span>
          <span className="text-xs text-ink-faint">각 행 = 선택지 하나. &quot;순서&quot; 오름차순으로 공개 화면에 표시됩니다.</span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs text-mark hover:text-mark border border-mark/30 hover:border-mark/40 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          <Plus size={13} /> 옵션 추가
        </button>
      </div>

      {prices.length === 0 ? (
        <p className="text-xs text-ink-faint py-4 text-center border border-rule rounded-xl bg-paper">
          아직 추가된 옵션이 없습니다. &quot;옵션 추가&quot;를 누르세요.
        </p>
      ) : (
        <div className="overflow-x-auto border border-rule rounded-xl bg-paper">
          <div className="min-w-[1000px]">
            {/* 헤더 행 */}
            <div className={`grid ${GRID} gap-2 px-3 py-2 border-b border-rule text-[11px] text-ink-faint font-medium items-center`}>
              <span title="작을수록 먼저 표시">순서</span>
              <span className="truncate">{axis1Name || '옵션값1'}</span>
              <span className="truncate">{axis2Name || '옵션값2'}</span>
              <span>유형</span>
              <span>주기</span>
              <span className="text-right">가격(원)</span>
              <span>tier</span>
              <span>Variant ID</span>
              <span>Checkout URL</span>
              <span />
            </div>

            {/* 데이터 행 — 1행 = 1옵션 */}
            {prices.map((price, idx) => (
              <div key={idx} className={`grid ${GRID} gap-2 px-3 py-2 border-b border-rule last:border-0 items-center`}>
                {/* 순서 */}
                <input
                  type="number" min={0} step={1}
                  value={price.sort_order}
                  onChange={(e) => onUpdate(idx, 'sort_order', e.target.value)}
                  title="작을수록 먼저 표시됩니다 (오름차순)"
                  className={`${cellInput} text-center`}
                />
                {/* 축1(기간) */}
                <input
                  value={price.option_axis1_label}
                  onChange={(e) => onUpdate(idx, 'option_axis1_label', e.target.value)}
                  placeholder="월간"
                  className={cellInput}
                />
                {/* 축2(PC개수) */}
                <input
                  value={price.option_axis2_label}
                  onChange={(e) => onUpdate(idx, 'option_axis2_label', e.target.value)}
                  placeholder="3PC용"
                  className={cellInput}
                />
                {/* 유형 */}
                <select
                  value={price.type}
                  onChange={(e) => onUpdate(idx, 'type', e.target.value)}
                  className={`${cellInput} cursor-pointer`}
                >
                  <option value="subscription">구독</option>
                  <option value="one_time">단일</option>
                </select>
                {/* 주기 */}
                <select
                  value={price.interval}
                  onChange={(e) => onUpdate(idx, 'interval', e.target.value)}
                  disabled={price.type === 'one_time'}
                  className={`${cellInput} cursor-pointer ${price.type === 'one_time' ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <option value="monthly">월간</option>
                  <option value="annual">연간</option>
                </select>
                {/* 가격 */}
                <PriceInput value={price.price} onChange={(v) => onUpdate(idx, 'price', v)} />
                {/* tier */}
                <input
                  value={price.license_tier}
                  onChange={(e) => onUpdate(idx, 'license_tier', e.target.value)}
                  placeholder="3pc"
                  className={`${cellInput} font-mono`}
                />
                {/* Variant ID — 중복 경고 */}
                <input
                  value={price.lemon_squeezy_variant_id}
                  onChange={(e) => onUpdate(idx, 'lemon_squeezy_variant_id', e.target.value)}
                  placeholder="123456"
                  title={dupVariant(price.lemon_squeezy_variant_id) ? '다른 행과 Variant ID가 중복입니다' : undefined}
                  className={`${cellInput} font-mono ${dupVariant(price.lemon_squeezy_variant_id) ? dupCell : ''}`}
                />
                {/* Checkout URL — 끝 8자 + 복사 · 클릭 편집, 중복 경고 */}
                <UrlCell
                  value={price.checkout_url}
                  dup={dupUrl(price.checkout_url)}
                  onChange={(v) => onUpdate(idx, 'checkout_url', v)}
                />
                {/* 삭제 */}
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="p-1.5 text-ink-faint hover:text-danger transition-colors rounded-md hover:bg-danger-soft justify-self-center"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasDup && (
        <p className="text-xs text-caution">
          ⚠ 경고색 셀은 Variant ID 또는 Checkout URL이 다른 행과 중복입니다. 옵션마다 서로 다른 값이어야 저장됩니다.
        </p>
      )}
    </div>
  )
}
