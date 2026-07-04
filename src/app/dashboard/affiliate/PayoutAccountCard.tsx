'use client'

/**
 * @컴포넌트: PayoutAccountCard
 * @설명: 제휴 정산 계좌 입력·표시 카드. 은행 드롭다운 + 계좌번호(숫자·하이픈) + 예금주.
 *        저장 후에는 계좌번호를 뒤 4자리만 남기고 마스킹해 표시하며, [수정]으로 다시 편집한다.
 */

import { useState } from 'react'
import { Landmark, Check, Loader2, Pencil } from 'lucide-react'
import { PAYOUT_BANKS, maskAccountNumber, normalizeAccountNumber } from '@/lib/banks'
import { savePayoutAccount } from './payout-actions'

interface Account {
  bank: string
  accountNumber: string
  accountHolder: string
}

const INPUT_CLS = 'w-full bg-paper border border-rule text-ink text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-mark placeholder:text-ink-faint'

export default function PayoutAccountCard({ initial }: { initial: Account }) {
  const hasAccount = !!initial.bank && !!initial.accountNumber
  const [saved, setSaved] = useState<Account>(initial)
  const [editing, setEditing] = useState(!hasAccount)

  const [bank, setBank] = useState(initial.bank ?? '')
  const [accountNumber, setAccountNumber] = useState(initial.accountNumber ?? '')
  const [accountHolder, setAccountHolder] = useState(initial.accountHolder ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    const res = await savePayoutAccount({ bank, accountNumber, accountHolder })
    setMsg({ ok: res.ok, text: res.message })
    if (res.ok) {
      const norm = normalizeAccountNumber(accountNumber)
      setSaved({ bank, accountNumber: norm, accountHolder })
      setAccountNumber(norm)
      setEditing(false)
    }
    setSaving(false)
  }

  function startEdit() {
    setBank(saved.bank)
    setAccountNumber(saved.accountNumber)
    setAccountHolder(saved.accountHolder)
    setMsg(null)
    setEditing(true)
  }

  return (
    <section className="mb-6 bg-paper-raised border border-rule rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Landmark size={18} className="text-mark" />
        <h2 className="text-sm font-semibold text-ink-faint uppercase tracking-wider">정산 계좌</h2>
      </div>

      {!editing ? (
        // ── 표시 모드(마스킹) ──
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-ink">
            <span className="font-medium">{saved.bank}</span>
            <span className="text-ink-soft"> · </span>
            <span className="font-mono">{maskAccountNumber(saved.accountNumber)}</span>
            <span className="text-ink-soft"> · </span>
            <span>{saved.accountHolder}</span>
          </div>
          <button onClick={startEdit} className="inline-flex items-center gap-1.5 text-xs text-mark border border-mark/40 hover:border-mark/60 px-3 py-1.5 rounded-lg transition-colors">
            <Pencil size={12} /> 수정
          </button>
        </div>
      ) : (
        // ── 편집 모드 ──
        <div className="space-y-3">
          <p className="text-xs text-ink-faint">정산이 필요할 때 사용할 본인 명의 계좌를 등록하세요.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={bank} onChange={(e) => setBank(e.target.value)} className={INPUT_CLS}>
              <option value="">은행 선택</option>
              {PAYOUT_BANKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9-]/g, ''))}
              inputMode="numeric"
              placeholder="계좌번호 (숫자·하이픈)"
              className={INPUT_CLS}
            />
            <input
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="예금주"
              className={INPUT_CLS}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-mark text-white hover:brightness-95 disabled:opacity-60 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? '저장 중…' : '계좌 저장'}
            </button>
            {hasAccount && (
              <button onClick={() => { setEditing(false); setMsg(null) }} disabled={saving} className="text-sm text-ink-soft border border-rule px-4 py-2 rounded-lg hover:text-ink transition-colors">
                취소
              </button>
            )}
          </div>
        </div>
      )}

      {msg && <p className={`text-xs mt-3 ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</p>}
    </section>
  )
}
