'use client'

/**
 * @컴포넌트: DownloadButton
 * @설명: Billing 페이지 구독 항목 다운로드 버튼
 *        - 플랫폼별 URL이 있으면 드롭다운, 단일이면 바로 이동
 *        - "New" 배지: last_downloaded_version ≠ latest changelog version
 *        - 클릭 시 last_downloaded_version 서버 액션으로 업데이트
 */

import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, Loader2 } from 'lucide-react'
import { markDownloaded } from './download-actions'

const PLATFORM_LABELS: Record<string, string> = {
  windows:      'Windows',
  mac:          'macOS',
  linux:        'Linux',
  chrome_store: 'Chrome Store',
  web:          'Web',
}

interface Props {
  productId: string
  version: string
  downloadUrls: Record<string, string>   // { mac: "url", windows: "url", ... }
  isNew: boolean                          // last_downloaded_version ≠ latest version
}

export default function DownloadButton({ productId, version, downloadUrls, isNew }: Props) {
  const platforms = Object.entries(downloadUrls).filter(([, url]) => url)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(!isNew)
  const ref = useRef<HTMLDivElement>(null)

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (platforms.length === 0) return null

  async function handleDownload(url: string) {
    setLoading(true)
    setOpen(false)
    // 버전 기록 (백그라운드)
    markDownloaded(productId, version).finally(() => {
      setLoading(false)
      setDone(true)
    })
    // 즉시 다운로드 URL 열기
    window.open(url, '_blank', 'noopener noreferrer')
  }

  // 플랫폼 1개 → 바로 버튼
  if (platforms.length === 1) {
    const [, url] = platforms[0]
    return (
      <button
        type="button"
        onClick={() => handleDownload(url)}
        disabled={loading}
        className="relative inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-400/30 hover:border-emerald-400/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading
          ? <Loader2 size={11} className="animate-spin" />
          : <Download size={11} />
        }
        Download
        {!done && (
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 text-[#0B1120] text-[8px] font-bold flex items-center justify-center">
            N
          </span>
        )}
      </button>
    )
  }

  // 플랫폼 여러 개 → 드롭다운
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        disabled={loading}
        className="relative inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-400/30 hover:border-emerald-400/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading
          ? <Loader2 size={11} className="animate-spin" />
          : <Download size={11} />
        }
        Download
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {!done && (
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 text-[#0B1120] text-[8px] font-bold flex items-center justify-center">
            N
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#111A2E] border border-[#1E293B] rounded-xl shadow-lg z-20 overflow-hidden">
          <div className="px-3 py-2 border-b border-[#1E293B]">
            <p className="text-[10px] text-[#475569] font-mono">{version}</p>
          </div>
          {platforms.map(([key, url]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleDownload(url)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/60 transition-colors text-left"
            >
              <Download size={11} className="text-emerald-400 shrink-0" />
              {PLATFORM_LABELS[key] ?? key}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
