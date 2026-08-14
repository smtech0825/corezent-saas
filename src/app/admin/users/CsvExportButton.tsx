'use client'

/**
 * @컴포넌트: CsvExportButton
 * @설명: 회원 목록 CSV 내보내기 버튼 — 개인정보 파일이므로 확인 창을 거친 뒤에만
 *        서버 액션(exportUsersCsv)을 부른다. 지금 화면의 검색·정렬 조건 그대로 나가고,
 *        반출 기록이 서버에서 먼저 남는다(기록 실패 시 서버가 반출을 거부).
 *        받은 CSV(UTF-8 BOM 포함)를 브라우저에서 파일로 저장한다.
 */

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { useToast } from '@/components/common/Toast'
import { exportUsersCsv } from './actions'
import type { UserSort } from './query'

export default function CsvExportButton({ q, sort, total }: {
  /** 현재 화면의 검색어(없으면 빈 문자열) */
  q: string
  /** 현재 화면의 정렬 */
  sort: UserSort
  /** 현재 조건의 전체 인원(확인 창 안내용) */
  total: number
}) {
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [exporting, setExporting] = useState(false)

  /**
   * @함수명: handleExport
   * @설명: 확인 창을 통과한 뒤 CSV를 받아 파일로 저장합니다. 실패는 토스트로 알립니다.
   */
  async function handleExport(): Promise<void> {
    if (exporting) return
    setExporting(true)
    try {
      const res = await exportUsersCsv({ q, sort })
      if (!res.ok) {
        showToast('error', res.reason)
        return
      }
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `corezent-users-${today}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast('success', `회원 ${res.count}명을 내보냈습니다. 반출 기록이 남았습니다.`)
      setConfirming(false)
    } catch {
      showToast('error', 'CSV 내보내기에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink border border-rule hover:border-mark/40 px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap"
      >
        <Download size={13} aria-hidden />
        CSV 내보내기
      </button>

      {/* 확인 모달 — 개인정보 파일 반출 재확인(탈퇴 모달과 같은 구조) */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => !exporting && setConfirming(false)}
          />
          <div className="relative bg-paper-raised border border-rule rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-sm font-semibold text-ink mb-2">회원 목록 CSV 내보내기</h3>
            <p className="text-sm text-ink-soft leading-relaxed mb-1.5">
              {q
                ? <>검색 조건(<b className="text-ink">{q}</b>)에 맞는 <b className="text-ink">{total}명</b>을 내보냅니다.</>
                : <>전체 회원 <b className="text-ink">{total}명</b>을 내보냅니다.</>}
            </p>
            <p className="text-xs text-ink-faint leading-relaxed mb-6">
              개인정보(이름·이메일)가 담긴 파일입니다. 내려받은 파일의 보관·삭제에 유의해 주세요.
              누가 언제 내보냈는지 기록이 남습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={exporting}
                className="flex-1 px-4 py-2.5 text-sm text-ink-soft border border-rule rounded-xl hover:bg-paper-shade transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-mark hover:brightness-95 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {exporting && <Loader2 size={14} className="animate-spin" aria-hidden />}
                {exporting ? '만드는 중...' : '내보내기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
