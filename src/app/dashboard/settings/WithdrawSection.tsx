'use client'

/**
 * @컴포넌트: WithdrawSection
 * @설명: 설정 화면 '회원 탈퇴'(위험 구역). 확인 모달 + "탈퇴" 문구 재확인 필수.
 *        소프트 삭제 서버 액션(withdrawSelf) 호출. 활성 구독이 있으면 차단 안내(먼저 취소 요구).
 */

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withdrawSelf } from './withdraw-actions'

const CONFIRM_WORD = '탈퇴'

export default function WithdrawSection() {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false) // 활성 구독으로 차단됨
  const [error, setError] = useState('')

  function openModal() {
    setConfirmText('')
    setBlocked(false)
    setError('')
    setOpen(true)
  }

  function closeModal() {
    if (loading) return
    setOpen(false)
  }

  async function handleWithdraw() {
    if (confirmText.trim() !== CONFIRM_WORD) return
    setLoading(true)
    setError('')
    setBlocked(false)
    try {
      const res = await withdrawSelf()
      if (res.ok) {
        // 세션 정리 후 홈으로 (전체 리로드로 상태 초기화)
        await createClient().auth.signOut().catch(() => {})
        window.location.href = '/'
        return
      }
      if (res.reason === 'active_subscription') {
        setBlocked(true)
      } else if (res.reason === 'unauthenticated') {
        setError('세션이 만료되었습니다. 다시 로그인해 주세요.')
      } else {
        setError('탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } catch {
      setError('탈퇴 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-paper-raised border border-danger/20 rounded-xl p-6 mt-6">
      <h2 className="text-base font-semibold text-danger mb-1.5">회원 탈퇴</h2>
      <p className="text-sm text-ink-soft mb-5">
        탈퇴하면 계정에 다시 로그인할 수 없습니다. 주문·라이선스 이력은 보관 목적상 보존되며,
        같은 이메일로의 재가입은 제한됩니다.
      </p>
      <button
        type="button"
        onClick={openModal}
        className="text-sm font-medium text-danger border border-danger/30 hover:border-danger/60 hover:bg-danger-soft px-4 py-2.5 rounded-lg transition-colors"
      >
        회원 탈퇴
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-md bg-paper-raised border border-rule rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-danger" />
              <h3 className="text-lg font-bold text-ink">정말 탈퇴하시겠어요?</h3>
            </div>

            {blocked ? (
              <div className="text-sm text-ink-soft space-y-3">
                <p className="text-caution font-medium">활성 구독이 있어 지금은 탈퇴할 수 없습니다.</p>
                <p>
                  먼저 구독을 취소한 뒤 다시 시도해 주세요. 취소해도 결제 기간이 끝날 때까지는
                  서비스를 계속 이용하실 수 있습니다.
                </p>
                <Link href="/dashboard/billing" className="inline-flex text-mark hover:underline">
                  결제·구독 관리로 이동 →
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-ink-soft mb-4">
                  이 작업은 되돌릴 수 없습니다. 계속하려면 아래에{' '}
                  <span className="font-semibold text-ink">&lsquo;{CONFIRM_WORD}&rsquo;</span> 을(를) 입력하세요.
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  className="w-full bg-paper border border-rule rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-danger/60 transition-colors mb-3"
                />
                {error && <p className="text-sm text-danger mb-3">{error}</p>}
              </>
            )}

            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-mark text-white hover:brightness-95 transition-colors disabled:opacity-50"
              >
                계속 이용하기
              </button>
              {!blocked && (
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={loading || confirmText.trim() !== CONFIRM_WORD}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border border-danger/30 text-danger hover:border-danger/60 hover:bg-danger-soft transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  탈퇴하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
