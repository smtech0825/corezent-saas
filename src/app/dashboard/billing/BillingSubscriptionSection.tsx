'use client'

/**
 * @컴포넌트: BillingSubscriptionSection
 * @설명: 구독 목록 렌더링 + 구독 취소(이탈 사유 설문 모달) 포함
 *        같은 productId의 Download 배지는 공유 state로 동기화
 */

import { useState } from 'react'
import Link from 'next/link'
import { Package, ExternalLink, BookOpen, X, Loader2 } from 'lucide-react'
import DownloadButton from './DownloadButton'
import { useToast } from '@/components/common/Toast'

export interface SubRow {
  id: string
  productId: string | undefined
  productName: string
  billingInterval: string
  currentPeriodEnd: string | null
  status: string
  lsSubscriptionId: string | null
  manualUrl: string | null
  changelog: { version: string; download_urls: Record<string, string> } | undefined
  isNew: boolean
  hasDownload: boolean
}

interface Props {
  rows: SubRow[]
}

// ─── 취소 사유 옵션 ───────────────────────────────────────────────────────────

const CANCEL_REASONS = [
  "It's too expensive.",
  "I'm missing some features I need.",
  "It's too difficult to use.",
  'I only needed it for a short-term project.',
  'I found a better alternative.',
  'Other / Prefer not to say.',
] as const

type CancelReason = typeof CANCEL_REASONS[number]
const OTHER_REASON: CancelReason = 'Other / Prefer not to say.'

// ─── 취소 대상 구독 타입 ──────────────────────────────────────────────────────

interface CancelTarget {
  id: string
  productName: string
  currentPeriodEnd: string | null
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function BillingSubscriptionSection({ rows }: Props) {
  const { showToast } = useToast()

  // 다운로드한 productId 집합 — 같은 상품 모든 배지 동기화
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set())

  // 취소 모달 상태
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [selectedReason, setSelectedReason] = useState<CancelReason | ''>('')
  const [otherText, setOtherText] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // 낙관적 UI: 취소된 구독의 status를 즉시 업데이트
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set())

  function handleDownloaded(productId: string) {
    setDownloadedIds((prev) => new Set([...prev, productId]))
  }

  function openCancelModal(row: SubRow) {
    setCancelTarget({
      id: row.id,
      productName: row.productName,
      currentPeriodEnd: row.currentPeriodEnd,
    })
    setSelectedReason('')
    setOtherText('')
  }

  function closeCancelModal() {
    if (cancelling) return
    setCancelTarget(null)
    setSelectedReason('')
    setOtherText('')
  }

  async function handleConfirmCancel() {
    if (!cancelTarget || !selectedReason) return
    setCancelling(true)

    const reason =
      selectedReason === OTHER_REASON && otherText.trim()
        ? `${OTHER_REASON} — ${otherText.trim()}`
        : selectedReason

    try {
      const res = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: cancelTarget.id, reason }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to cancel')
      }

      // 낙관적 UI 업데이트
      setCancelledIds((prev) => new Set([...prev, cancelTarget.id]))
      showToast('success', 'Your subscription has been cancelled. You can continue using the service until the end of your billing period.')
      closeCancelModal()
    } catch (err) {
      console.error('[cancel]', err)
      showToast('error', 'Failed to cancel subscription. Please try again or contact support.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const effectiveStatus = cancelledIds.has(row.id) ? 'cancelled' : row.status
          const badgeActive = row.isNew && row.hasDownload && !downloadedIds.has(row.productId ?? '')
          const isActive = effectiveStatus === 'active'

          return (
            <div
              key={row.id}
              className="bg-[#111A2E] border border-[#1E293B] rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#0B1120] border border-[#1E293B] flex items-center justify-center shrink-0">
                  <Package size={18} className="text-[#38BDF8]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{row.productName}</p>
                    {badgeActive && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#475569] mt-0.5">
                    {row.billingInterval === 'annual' ? 'Annual' : 'Monthly'} plan
                    {row.currentPeriodEnd &&
                      ` · Renews ${new Date(row.currentPeriodEnd).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <SubStatusBadge status={effectiveStatus} />
                <Link
                  href="/dashboard/licenses"
                  className="inline-flex items-center gap-1.5 text-xs text-[#38BDF8] hover:text-white border border-[#38BDF8]/30 hover:border-[#38BDF8]/60 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink size={11} />
                  Check License
                </Link>
                {row.manualUrl && (
                  <a
                    href={row.manualUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-400/30 hover:border-amber-400/60 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <BookOpen size={11} />
                    Manual
                  </a>
                )}
                {row.hasDownload && row.changelog && row.productId && (
                  <DownloadButton
                    productId={row.productId}
                    version={row.changelog.version}
                    downloadUrls={row.changelog.download_urls}
                    isNew={badgeActive}
                    onDownloaded={handleDownloaded}
                  />
                )}
                {/* 활성 구독에만 취소 버튼 표시 */}
                {isActive && (
                  <button
                    onClick={() => openCancelModal(row)}
                    className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 취소 사유 설문 모달 */}
      {cancelTarget && (
        <CancellationModal
          target={cancelTarget}
          selectedReason={selectedReason}
          onSelectReason={setSelectedReason}
          otherText={otherText}
          onOtherText={setOtherText}
          cancelling={cancelling}
          onKeep={closeCancelModal}
          onConfirm={handleConfirmCancel}
        />
      )}
    </>
  )
}

// ─── 취소 사유 모달 ───────────────────────────────────────────────────────────

interface ModalProps {
  target: CancelTarget
  selectedReason: CancelReason | ''
  onSelectReason: (r: CancelReason) => void
  otherText: string
  onOtherText: (t: string) => void
  cancelling: boolean
  onKeep: () => void
  onConfirm: () => void
}

function CancellationModal({
  target, selectedReason, onSelectReason, otherText, onOtherText,
  cancelling, onKeep, onConfirm,
}: ModalProps) {
  const fmtDate = target.currentPeriodEnd
    ? new Date(target.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  const canSubmit = !!selectedReason && !cancelling

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onKeep}
      />

      {/* 모달 카드 */}
      <div className="relative z-10 w-full max-w-md bg-[#111A2E] border border-[#1E293B] rounded-2xl shadow-2xl p-6">
        {/* 닫기 버튼 */}
        <button
          onClick={onKeep}
          className="absolute top-4 right-4 text-[#475569] hover:text-white transition-colors"
          disabled={cancelling}
        >
          <X size={16} />
        </button>

        {/* 헤더 */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-white">We're sorry to see you go.</h2>
          <p className="text-sm text-[#94A3B8] mt-1.5">
            Could you tell us why you are cancelling?
          </p>
          {fmtDate && (
            <p className="text-xs text-[#475569] mt-2 bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2">
              Your subscription will remain active until{' '}
              <span className="text-amber-400 font-medium">{fmtDate}</span>.
            </p>
          )}
        </div>

        {/* 라디오 옵션 */}
        <div className="flex flex-col gap-2 mb-6">
          {CANCEL_REASONS.map((reason) => (
            <label
              key={reason}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                selectedReason === reason
                  ? 'border-[#38BDF8]/40 bg-[#38BDF8]/5'
                  : 'border-[#1E293B] hover:border-[#334155]'
              }`}
            >
              <input
                type="radio"
                name="cancel-reason"
                value={reason}
                checked={selectedReason === reason}
                onChange={() => onSelectReason(reason)}
                className="mt-0.5 accent-[#38BDF8] shrink-0"
              />
              <span className="text-sm text-[#94A3B8] leading-snug">{reason}</span>
            </label>
          ))}

          {/* Other 선택 시 선택적 텍스트 영역 */}
          {selectedReason === OTHER_REASON && (
            <textarea
              value={otherText}
              onChange={(e) => onOtherText(e.target.value)}
              placeholder="Optional: tell us more…"
              rows={3}
              className="w-full mt-1 bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors resize-none"
            />
          )}
        </div>

        {/* 버튼 영역 — Keep(Primary) / Cancel(Ghost/Destructive) */}
        <div className="flex flex-col gap-2">
          {/* Keep My Subscription — primary, 강조 */}
          <button
            onClick={onKeep}
            disabled={cancelling}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#38BDF8] text-[#0B1120] hover:bg-[#0ea5e9] transition-colors disabled:opacity-50"
          >
            Keep My Subscription
          </button>

          {/* Cancel Subscription — ghost/destructive, 비강조 */}
          <button
            onClick={onConfirm}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-red-500/30 text-red-400 hover:border-red-500/60 hover:text-red-300 hover:bg-red-500/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {cancelling && <Loader2 size={14} className="animate-spin" />}
            Cancel Subscription
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 상태 배지 ────────────────────────────────────────────────────────────────

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, { style: string; label: string }> = {
    active:    { style: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'active' },
    paused:    { style: 'text-amber-400 bg-amber-500/10 border-amber-500/20',       label: 'paused' },
    cancelled: { style: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]',            label: 'cancelled' },
    expired:   { style: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]',            label: 'expired' },
  }
  const { style, label } = map[status] ?? map.cancelled
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${style}`}>
      {label}
    </span>
  )
}
