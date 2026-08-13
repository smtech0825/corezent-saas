'use client'

/**
 * @컴포넌트: IssueQuoteForm
 * @설명: 견적 요청 상세 안의 [견적서 만들기] — 상품 옵션을 고르고 수량(기본=요청 PC 수)을
 *        정해 발급한다. 성공하면 PDF가 바로 내려받아지고 상태가 '견적 발급됨'으로 바뀐다.
 *        실패(공급자 정보 빈칸 등)하면 서버가 보낸 이유를 그대로 보여준다.
 *        같은 요청에 여러 번 발급할 수 있다 — 번호는 서버(DB)가 채번해 겹치지 않는다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, FileDown } from 'lucide-react'
import SelectField from '@/components/common/SelectField'

export interface PriceOption {
  id: string
  label: string   // "상품명 — 옵션 (₩단가)" 형태로 서버가 조립해 전달
}

export default function IssueQuoteForm({
  requestId,
  defaultQty,
  options,
}: {
  requestId: string
  /** 요청 PC 수 — 참고 표시용. 옵션 단가가 이미 "대수 포함"인 상품이 있어 기본 수량으로 쓰지 않는다(검증 지적) */
  defaultQty: number
  options: PriceOption[]
}) {
  const router = useRouter()
  const [priceId, setPriceId] = useState(options[0]?.id ?? '')
  // 기본 수량 1 — 대수 포함 옵션(예: "10PC용")에 요청 PC 수를 곱하면 금액이 몇 배로 튄다
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [issuedNo, setIssuedNo] = useState('')

  /** 발급 요청 — 수량을 검증해 보내고, 성공 시 PDF를 내려받는다. 실패 이유는 그대로 표시 */
  async function issue() {
    setError('')
    const quantity = Math.trunc(Number(qty))
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('수량을 1 이상의 숫자로 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/quotes/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, productPriceId: priceId, quantity }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? '견적서 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      // PDF 내려받기 — 파일명은 견적 번호
      const quoteNo = res.headers.get('X-Quote-No') ?? 'quotation'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quoteNo}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setIssuedNo(quoteNo)
      router.refresh() // 상태 배지(견적 발급됨) 갱신
    } catch {
      setError('네트워크 오류입니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (options.length === 0) {
    return <p className="text-xs text-caution">활성화된 상품 옵션이 없어 견적서를 만들 수 없습니다.</p>
  }

  return (
    <div className="mt-3 pt-3 border-t border-rule space-y-2.5">
      <p className="text-xs font-medium text-ink-soft">견적서 발급</p>
      <p className="text-xs text-ink-faint">
        요청 PC 수: <b className="text-ink-soft">{defaultQty}대</b> — 옵션 이름에 대수(예: 10PC용)가 이미 들어 있으면 수량은 1로 두세요. 금액 = 옵션 단가 × 수량.
      </p>
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
        <SelectField size="md" aria-label="상품 옵션" value={priceId} onChange={(e) => setPriceId(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </SelectField>
        <div className="flex items-center gap-2">
          <label htmlFor={`qty-${requestId}`} className="text-xs text-ink-faint whitespace-nowrap">수량</label>
          <input
            id={`qty-${requestId}`}
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-24 bg-paper border border-rule rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-mark"
          />
        </div>
        <button
          onClick={issue}
          disabled={busy || !priceId}
          className="inline-flex items-center justify-center gap-2 bg-mark hover:brightness-95 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
          {busy ? '만드는 중…' : '견적서 만들기 (PDF)'}
        </button>
      </div>
      {issuedNo && !error && (
        <p className="text-xs text-ok">견적서 {issuedNo} 가 내려받아졌습니다. 다시 발급하면 새 번호로 만들어집니다.</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
