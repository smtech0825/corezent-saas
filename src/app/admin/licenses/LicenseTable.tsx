'use client'

/**
 * @컴포넌트: LicenseTable
 * @설명: 관리자 라이선스 테이블 — 검색·필터·페이지네이션·Revoke 모달
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, Ban, X } from 'lucide-react'

export interface License {
  id: string
  serialKey: string    // masked (XXXX-****-****-XXXX)
  email: string
  name: string
  productName: string
  option: string
  status: string       // 'active' | 'expired' | 'revoked'
  period: string | null  // 'monthly' | 'annual' | null
  renewalDate: string | null
  expiresAt: string | null
  createdAt: string
}

type FilterStatus = 'all' | 'active' | 'canceled' | 'expired'

const PAGE_SIZE = 15

// 갱신·만료 일시 — 날짜 + 시:분 (없으면 '—')
function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':  return { label: '활성',     cls: 'text-ok bg-ok-soft border border-ok/20' }
    case 'revoked': return { label: '취소됨',   cls: 'text-danger bg-danger-soft border border-danger/20' }
    case 'expired': return { label: '만료됨',   cls: 'text-danger bg-danger-soft border border-danger/20' }
    default:        return { label: status,      cls: 'text-ink-soft bg-paper-shade border border-rule' }
  }
}

function getPeriodBadge(period: string | null) {
  if (!period) return null
  if (period === 'annual')
    return { label: '연간',  cls: 'text-info bg-info-soft border border-info/20' }
  return { label: '월간', cls: 'text-ink-soft bg-paper-shade border border-rule' }
}

interface Props {
  licenses: License[]
}

export default function LicenseTable({ licenses }: Props) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [page, setPage] = useState(1)
  const [revokeTarget, setRevokeTarget] = useState<License | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  // 검색 디바운싱 400ms
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [search])

  // 필터 변경 시 첫 페이지로
  useEffect(() => { setPage(1) }, [filterStatus])

  // 필터링
  const filtered = useMemo(() => {
    return licenses.filter((l) => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        if (!l.email.toLowerCase().includes(q) && !l.name.toLowerCase().includes(q)) return false
      }
      if (filterStatus === 'active'   && l.status !== 'active')  return false
      if (filterStatus === 'canceled' && l.status !== 'revoked') return false
      if (filterStatus === 'expired'  && l.status !== 'expired') return false
      return true
    })
  }, [licenses, debouncedSearch, filterStatus])

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    setRevokeError(null)
    try {
      const res = await fetch('/api/admin/licenses/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: revokeTarget.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRevokeError((data as { error?: string }).error ?? '라이선스 회수에 실패했습니다')
        setRevoking(false)
        return
      }
      // 성공 → 페이지 새로고침
      window.location.reload()
    } catch {
      setRevokeError('네트워크 오류입니다. 다시 시도해 주세요.')
      setRevoking(false)
    }
  }

  function closeModal() {
    setRevokeTarget(null)
    setRevokeError(null)
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">라이선스</h1>
        <p className="text-sm text-ink-soft mt-1">총 {licenses.length}개의 라이선스</p>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 상태 필터 드롭다운 */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="bg-paper border border-rule text-ink-soft text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-mark sm:w-40 shrink-0 cursor-pointer"
        >
          <option value="all">전체 상태</option>
          <option value="active">활성</option>
          <option value="canceled">취소됨</option>
          <option value="expired">만료됨</option>
        </select>

        {/* 이메일 검색바 */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일로 검색..."
            className="w-full bg-paper border border-rule text-ink text-sm rounded-xl pl-9 pr-4 py-2.5 placeholder:text-ink-faint focus:outline-none focus:border-mark"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="border border-rule bg-paper-raised rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-faint">라이선스가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-rule">
                  <th className="text-left px-6 py-3 text-xs text-ink-faint font-medium whitespace-nowrap">시리얼 키</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium whitespace-nowrap">제품</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium whitespace-nowrap">사용자</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium whitespace-nowrap">상태</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium whitespace-nowrap">결제 주기</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium whitespace-nowrap">갱신일</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium whitespace-nowrap">만료일</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium whitespace-nowrap">작업</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((l) => {
                  const badge       = getStatusBadge(l.status)
                  const periodBadge = getPeriodBadge(l.period)
                  return (
                    <tr key={l.id} className="border-b border-rule/50 hover:bg-paper-shade transition-colors">
                      <td className="px-6 py-3">
                        <span className="font-mono text-xs text-ink-soft whitespace-nowrap">{l.serialKey}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <div className="text-ink text-sm truncate">{l.productName || '—'}</div>
                        {l.option && <div className="text-mark text-xs truncate">{l.option}</div>}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {l.name && <div className="text-ink text-sm truncate">{l.name}</div>}
                        <div className="text-ink-soft text-xs truncate">{l.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {periodBadge ? (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${periodBadge.cls}`}>
                            {periodBadge.label}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-faint whitespace-nowrap text-xs">{fmtDateTime(l.renewalDate)}</td>
                      <td className="px-4 py-3 text-ink-faint whitespace-nowrap text-xs">{fmtDateTime(l.expiresAt)}</td>
                      <td className="px-4 py-3">
                        {l.status !== 'revoked' ? (
                          <button
                            onClick={() => setRevokeTarget(l)}
                            className="inline-flex items-center gap-1.5 text-xs text-danger hover:brightness-95 border border-danger/20 hover:border-danger/40 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Ban size={11} />
                            회수
                          </button>
                        ) : (
                          <span className="text-xs text-ink-faint">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-rule">
            <span className="text-xs text-ink-faint">
              {filtered.length}개 결과 · {page} / {totalPages} 페이지
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-rule text-ink-faint hover:text-ink hover:border-mark/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-rule text-ink-faint hover:text-ink hover:border-mark/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Revoke 확인 모달 */}
      {revokeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-paper-raised border border-rule rounded-2xl p-6 w-full max-w-md shadow-2xl">
            {/* 모달 헤더 */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-danger-soft border border-danger/20 shrink-0">
                  <Ban size={18} className="text-danger" />
                </div>
                <h3 className="text-ink font-semibold">라이선스 회수</h3>
              </div>
              <button
                onClick={closeModal}
                className="text-ink-faint hover:text-ink transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* 경고 문구 */}
            <p className="text-sm text-ink-soft mb-3 leading-relaxed">
              이 라이선스를 회수하시겠습니까?{' '}
              <span className="text-ink font-medium">사용자는 즉시 접근 권한을 잃게 됩니다.</span>
            </p>
            <p className="font-mono text-xs text-ink-faint bg-paper border border-rule rounded-lg px-3 py-2 mb-5">
              {revokeTarget.serialKey}
            </p>

            {/* 에러 */}
            {revokeError && (
              <p className="text-xs text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2 mb-4">
                {revokeError}
              </p>
            )}

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={closeModal}
                disabled={revoking}
                className="flex-1 py-2.5 rounded-xl border border-rule text-sm text-ink-soft hover:text-ink hover:border-mark/40 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex-1 py-2.5 rounded-xl bg-danger-soft border border-danger/30 text-sm text-danger hover:brightness-95 hover:border-danger/50 font-semibold transition-colors disabled:opacity-50"
              >
                {revoking ? '회수 중...' : '회수 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
