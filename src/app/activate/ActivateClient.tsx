'use client'

/**
 * @컴포넌트: ActivateClient
 * @설명: 라이선스 키 입력 및 조회 클라이언트 컴포넌트
 *        시리얼 키(XXXX-XXXX-XXXX-XXXX)를 입력하면 라이선스 상태를 조회합니다.
 */

import { useState, useTransition } from 'react'
import { Key, CheckCircle2, XCircle, Loader2, ShieldCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface LicenseResult {
  found: boolean
  status?: string
  productName?: string
  expiresAt?: string | null
  maxDevices?: number | null
  isOwner?: boolean
  error?: string
}

const SERIAL_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

/**
 * @함수명: formatSerial
 * @설명: 입력값을 시리얼 키 형식(XXXX-XXXX-XXXX-XXXX)으로 자동 포맷합니다.
 */
function formatSerial(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
  const parts = clean.match(/.{1,4}/g) ?? []
  return parts.join('-')
}

/**
 * @함수명: statusLabel
 * @설명: DB의 영문 라이선스 상태값을 한글 라벨로 변환합니다.
 */
const STATUS_LABELS: Record<string, string> = {
  active:    '활성',
  expired:   '만료',
  cancelled: '해지',
  inactive:  '비활성',
}
function statusLabel(status?: string | null): string {
  if (!status) return '—'
  return STATUS_LABELS[status] ?? status
}

export default function ActivateClient() {
  const [serialKey, setSerialKey] = useState('')
  const [result, setResult] = useState<LicenseResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const isValidFormat = SERIAL_REGEX.test(serialKey)

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setResult(null)
    setSerialKey(formatSerial(e.target.value))
  }

  function handleLookup() {
    if (!isValidFormat) return
    startTransition(async () => {
      setResult(null)
      const supabase = createClient()

      // 현재 로그인 사용자 확인
      const { data: { user } } = await supabase.auth.getUser()

      // 라이선스 조회 (product join)
      const { data: license, error } = await supabase
        .from('licenses')
        .select('id, status, expires_at, max_devices, user_id, products(name)')
        .eq('serial_key', serialKey)
        .single()

      if (error || !license) {
        setResult({ found: false, error: '라이선스 키를 찾을 수 없습니다. 키를 확인 후 다시 시도해 주세요.' })
        return
      }

      const prod = license.products as { name: string } | { name: string }[] | null
      const productName = (Array.isArray(prod) ? prod[0]?.name : prod?.name) ?? 'CoreZent 제품'
      const isOwner = user ? user.id === license.user_id : false

      setResult({
        found: true,
        status: license.status,
        productName,
        expiresAt: license.expires_at,
        maxDevices: license.max_devices,
        isOwner,
      })
    })
  }

  return (
    <div className="w-full max-w-md">
      {/* 헤더 */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
          <Key size={24} className="text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">라이선스 활성화</h1>
        <p className="text-sm text-[#94A3B8]">
          구매 이메일로 받은 라이선스 키를 입력하여 제품을 확인하고 활성화하세요.
        </p>
      </div>

      {/* 입력 폼 */}
      <div className="bg-[#111A2E] border border-[#1E293B] rounded-2xl p-6 mb-4">
        <label className="block text-xs text-[#475569] uppercase tracking-widest font-semibold mb-2">
          라이선스 키
        </label>
        <input
          value={serialKey}
          onChange={handleInput}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          maxLength={19}
          spellCheck={false}
          className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-white placeholder-[#1E293B] focus:outline-none focus:border-amber-500/50 transition-colors"
        />
        <p className="text-[10px] text-[#475569] mt-2 text-center">
          형식: XXXX-XXXX-XXXX-XXXX · 영문과 숫자만 입력
        </p>

        <button
          onClick={handleLookup}
          disabled={!isValidFormat || isPending}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-amber-500 text-[#0B1120] font-semibold py-3 rounded-xl hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isPending ? (
            <><Loader2 size={16} className="animate-spin" /> 확인 중...</>
          ) : (
            <><ShieldCheck size={16} /> 라이선스 확인</>
          )}
        </button>
      </div>

      {/* 결과 표시 */}
      {result && (
        <div
          className={`rounded-2xl border p-5 transition-all ${
            result.found && result.status === 'active'
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : result.found
              ? 'bg-amber-500/5 border-amber-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}
        >
          {result.found ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                {result.status === 'active' ? (
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={18} className="text-amber-400 shrink-0" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    result.status === 'active' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {result.status === 'active' ? '유효한 라이선스' : `라이선스 ${statusLabel(result.status)}`}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <Row label="제품" value={result.productName ?? '—'} />
                <Row label="상태" value={statusLabel(result.status)} />
                <Row
                  label="만료일"
                  value={
                    result.expiresAt
                      ? new Date(result.expiresAt).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '없음 (평생)'
                  }
                />
                <Row
                  label="기기"
                  value={result.maxDevices ? `최대 ${result.maxDevices}대` : '무제한'}
                />
              </div>

              {result.isOwner ? (
                <Link
                  href="/dashboard/licenses"
                  className="mt-5 flex items-center justify-center gap-2 text-sm text-[#38BDF8] hover:text-white transition-colors"
                >
                  대시보드에서 보기 <ArrowRight size={13} />
                </Link>
              ) : (
                <p className="mt-4 text-xs text-[#475569] text-center">
                  이 라이선스는 다른 계정에 등록되어 있습니다.{' '}
                  <Link href="/auth/login" className="text-[#38BDF8] hover:underline">
                    로그인
                  </Link>
                  하여 내 라이선스를 관리하세요.
                </p>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2">
              <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400 mb-1">라이선스를 찾을 수 없습니다</p>
                <p className="text-xs text-[#94A3B8]">{result.error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 하단 링크 */}
      <div className="mt-6 text-center text-xs text-[#475569] space-x-4">
        <Link href="/pricing" className="hover:text-[#94A3B8] transition-colors">
          라이선스 구매
        </Link>
        <span>·</span>
        <Link href="/dashboard" className="hover:text-[#94A3B8] transition-colors">
          대시보드
        </Link>
        <span>·</span>
        <Link href="/dashboard/support" className="hover:text-[#94A3B8] transition-colors">
          고객지원
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#475569]">{label}</span>
      <span className="text-white font-medium text-right">{value}</span>
    </div>
  )
}
