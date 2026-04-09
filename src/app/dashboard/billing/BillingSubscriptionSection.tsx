'use client'

/**
 * @컴포넌트: BillingSubscriptionSection
 * @설명: 구독 목록 렌더링 — 같은 productId의 모든 Download 배지를 공유 state로 동기화
 *        서버에서 받은 pre-processed 데이터를 렌더링
 */

import { useState } from 'react'
import Link from 'next/link'
import { Package, ExternalLink, BookOpen } from 'lucide-react'
import DownloadButton from './DownloadButton'

export interface SubRow {
  id: string
  productId: string | undefined
  productName: string
  billingInterval: string
  currentPeriodEnd: string | null
  status: string
  manualUrl: string | null
  changelog: { version: string; download_urls: Record<string, string> } | undefined
  isNew: boolean
  hasDownload: boolean
}

interface Props {
  rows: SubRow[]
}

export default function BillingSubscriptionSection({ rows }: Props) {
  // 다운로드한 productId 집합 — 같은 상품 모든 배지 동기화
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set())

  function handleDownloaded(productId: string) {
    setDownloadedIds((prev) => new Set([...prev, productId]))
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const badgeActive = row.isNew && row.hasDownload && !downloadedIds.has(row.productId ?? '')

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
              <SubStatusBadge status={row.status} />
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
            </div>
          </div>
        )
      })}
    </div>
  )
}

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
