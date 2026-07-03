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
  optionLabel: string | null
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
  '가격이 너무 비쌉니다.',
  '필요한 기능이 부족합니다.',
  '사용하기가 너무 어렵습니다.',
  '단기 프로젝트에만 필요했습니다.',
  '더 나은 대안을 찾았습니다.',
  '기타 / 답변하지 않음.',
] as const

type CancelReason = typeof CANCEL_REASONS[number]
const OTHER_REASON: CancelReason = '기타 / 답변하지 않음.'

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
      showToast('success', '구독이 취소되었습니다. 결제 기간이 끝날 때까지 서비스를 계속 이용하실 수 있습니다.')
      closeCancelModal()
    } catch (err) {
      console.error('[cancel]', err)
      showToast('error', '구독 취소에 실패했습니다. 다시 시도하거나 고객센터에 문의해 주세요.')
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
              className="bg-paper-raised border border-rule rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-paper border border-rule flex items-center justify-center shrink-0">
                  <Package size={18} className="text-mark" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-ink font-medium">{row.productName}</p>
                    {row.optionLabel && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-mark/10 text-mark border border-mark/30">
                        {row.optionLabel}
                      </span>
                    )}
                    {badgeActive && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-mark/10 text-mark border border-mark/30">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-faint mt-0.5">
                    {row.billingInterval === 'annual' ? '연간' : '월간'} 플랜
                    {row.currentPeriodEnd &&
                      ` · 갱신일 ${new Date(row.currentPeriodEnd).toLocaleDateString('ko-KR', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <SubStatusBadge status={effectiveStatus} />
                <Link
                  href="/dashboard/licenses"
                  className="inline-flex items-center gap-1.5 text-xs text-mark hover:text-ink border border-mark/40 hover:border-mark/60 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink size={11} />
                  라이선스 확인
                </Link>
                {row.manualUrl && (
                  <a
                    href={row.manualUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-mark hover:text-ink border border-mark/40 hover:border-mark/60 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <BookOpen size={11} />
                    사용 설명서
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
                    className="inline-flex items-center gap-1.5 text-xs text-danger hover:text-danger border border-danger/20 hover:border-danger/40 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    구독 취소
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
    ? new Date(target.currentPeriodEnd).toLocaleDateString('ko-KR', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  const canSubmit = !!selectedReason && !cancelling

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
        onClick={onKeep}
      />

      {/* 모달 카드 */}
      <div className="relative z-10 w-full max-w-md bg-paper-raised border border-rule rounded-2xl shadow-2xl p-6">
        {/* 닫기 버튼 */}
        <button
          onClick={onKeep}
          className="absolute top-4 right-4 text-ink-faint hover:text-ink transition-colors"
          disabled={cancelling}
        >
          <X size={16} />
        </button>

        {/* 헤더 */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-ink">떠나신다니 아쉽습니다.</h2>
          <p className="text-sm text-ink-soft mt-1.5">
            취소하시는 이유를 알려주시겠어요?
          </p>
          {fmtDate && (
            <p className="text-xs text-ink-faint mt-2 bg-paper border border-rule rounded-lg px-3 py-2">
              구독은{' '}
              <span className="text-mark font-medium">{fmtDate}</span>
              까지 유지됩니다.
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
                  ? 'border-mark/40 bg-mark/5'
                  : 'border-rule hover:border-mark/40'
              }`}
            >
              <input
                type="radio"
                name="cancel-reason"
                value={reason}
                checked={selectedReason === reason}
                onChange={() => onSelectReason(reason)}
                className="mt-0.5 accent-mark shrink-0"
              />
              <span className="text-sm text-ink-soft leading-snug">{reason}</span>
            </label>
          ))}

          {/* Other 선택 시 선택적 텍스트 영역 */}
          {selectedReason === OTHER_REASON && (
            <textarea
              value={otherText}
              onChange={(e) => onOtherText(e.target.value)}
              placeholder="(선택) 자세한 내용을 알려주세요"
              rows={3}
              className="w-full mt-1 bg-paper border border-rule rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark transition-colors resize-none"
            />
          )}
        </div>

        {/* 버튼 영역 — Keep(Primary) / Cancel(Ghost/Destructive) */}
        <div className="flex flex-col gap-2">
          {/* Keep My Subscription — primary, 강조 */}
          <button
            onClick={onKeep}
            disabled={cancelling}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-mark text-white hover:brightness-95 transition-colors disabled:opacity-50"
          >
            구독 유지하기
          </button>

          {/* Cancel Subscription — ghost/destructive, 비강조 */}
          <button
            onClick={onConfirm}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-danger/30 text-danger hover:border-danger/60 hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {cancelling && <Loader2 size={14} className="animate-spin" />}
            구독 취소하기
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 상태 배지 ────────────────────────────────────────────────────────────────

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, { style: string; label: string }> = {
    active:    { style: 'text-ok bg-ok-soft border-ok/20',           label: '활성' },
    paused:    { style: 'text-caution bg-caution-soft border-caution/20', label: '일시정지' },
    cancelled: { style: 'text-ink-soft bg-paper-shade border-rule',  label: '취소됨' },
    expired:   { style: 'text-ink-soft bg-paper-shade border-rule',  label: '만료됨' },
  }
  const { style, label } = map[status] ?? map.cancelled
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${style}`}>
      {label}
    </span>
  )
}
