'use client'

/**
 * @컴포넌트: OrgInfoSection
 * @설명: 주문 상세의 "기관 구매 정보" 편집 구역 — 기관명·사업자등록번호·담당자·
 *        세금계산서 발급번호 4칸. 전부 선택 입력(개인 주문은 비워 둔다).
 *        세금계산서 번호는 대표님이 홈택스에서 발급 후 손으로 적는 칸이다.
 *        저장 실패(061 미적용 포함)는 서버가 보낸 이유를 그대로 보여준다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check } from 'lucide-react'

const INPUT_CLS =
  'w-full bg-paper border border-rule rounded-xl px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark transition-colors'

export interface OrgInfo {
  orgName: string
  orgBizRegNo: string
  orgContactName: string
  taxInvoiceNo: string
}

export default function OrgInfoSection({ orderId, initial }: { orderId: string; initial: OrgInfo }) {
  const router = useRouter()
  const [form, setForm] = useState<OrgInfo>(initial)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  /** 입력값 갱신 — 바꾸는 순간 "저장됨" 표시를 끈다 */
  function set(key: keyof OrgInfo, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  /** 저장 — 실패하면 서버가 보낸 이유(061 미적용 안내 포함)를 그대로 표시 */
  async function save() {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/admin/orders/org-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, ...form }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('네트워크 오류입니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border border-rule bg-paper-raised rounded-card p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">기관 구매 정보</h2>
        <p className="text-xs text-ink-faint mt-0.5">
          기관 주문일 때만 채우는 칸입니다. 개인 주문은 비워 두세요. 세금계산서 번호는 홈택스에서 발급 후 적습니다.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor={`org-name-${orderId}`} className="text-xs text-ink-soft">기관명</label>
          <input id={`org-name-${orderId}`} value={form.orgName} onChange={(e) => set('orgName', e.target.value)} className={INPUT_CLS} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`org-bizno-${orderId}`} className="text-xs text-ink-soft">사업자등록번호</label>
          <input id={`org-bizno-${orderId}`} value={form.orgBizRegNo} onChange={(e) => set('orgBizRegNo', e.target.value)} placeholder="000-00-00000" className={INPUT_CLS} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`org-contact-${orderId}`} className="text-xs text-ink-soft">담당자</label>
          <input id={`org-contact-${orderId}`} value={form.orgContactName} onChange={(e) => set('orgContactName', e.target.value)} className={INPUT_CLS} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`org-taxno-${orderId}`} className="text-xs text-ink-soft">세금계산서 발급번호</label>
          <input id={`org-taxno-${orderId}`} value={form.taxInvoiceNo} onChange={(e) => set('taxInvoiceNo', e.target.value)} className={INPUT_CLS} />
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 bg-mark hover:brightness-95 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {saved && !busy && <Check size={14} />}
          {busy ? '저장 중…' : saved ? '저장됨!' : '저장'}
        </button>
      </div>
    </section>
  )
}
