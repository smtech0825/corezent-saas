'use client'

/**
 * @컴포넌트: ResetPasswordForm
 * @설명: 비밀번호 재설정 이메일 발송 폼
 *        이메일 입력 → Supabase가 재설정 링크 발송
 *        링크 클릭 시 /auth/callback → /auth/update-password 로 이동
 */

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isRateLimited } from '@/lib/auth-error'
import { checkEmailRegistered } from './actions'
import AuthBrand from '../_components/AuthBrand'

export default function ResetPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 가입된 이메일인지 먼저 확인
    const exists = await checkEmailRegistered(email)
    if (!exists) {
      setError('이 이메일로 가입된 계정을 찾을 수 없습니다.')
      setLoading(false)
      return
    }

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (err) {
      // 원문은 영문이라 화면에 내보내지 않는다. 사유는 브라우저 기록에만 남긴다.
      console.error('[reset-password] 재설정 메일 발송 실패:', err.message)
      // 재전송 간격 제한에 걸린 경우를 "주소가 틀렸다"로 안내하면, 맞는 주소를 계속 넣게 된다.
      setError(
        isRateLimited(err.message)
          ? '잠시 후 다시 시도해 주세요. (재전송 간격 제한)'
          : '재설정 메일을 보내지 못했습니다. 이메일 주소를 확인한 뒤 다시 시도해 주세요.',
      )
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  return (
    <div className="theme-paper min-h-screen bg-paper text-ink flex">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* 모바일 로고 */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl text-ink">
              <span className="w-7 h-7 rounded border-[1.5px] border-seal flex items-center justify-center text-seal font-black -rotate-3">C</span>
              CoreZent
            </Link>
          </div>

          {done ? (
            /* 발송 완료 */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-pen/5 border border-pen/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} className="text-pen" />
              </div>
              <h1 className="text-2xl font-serif font-black text-ink mb-3">이메일을 확인해 주세요</h1>
              <p className="text-ink-soft text-sm leading-relaxed mb-6">
                <span className="text-ink font-medium">{email}</span>{' '}
                주소로 비밀번호 재설정 링크를 보냈습니다.
              </p>
              <Link href="/auth/login" className="text-sm text-pen hover:underline">
                ← 로그인으로 돌아가기
              </Link>
            </div>
          ) : (
            /* 이메일 입력 */
            <>
              <h1 className="text-2xl font-serif font-black text-ink mb-1">비밀번호를 잊으셨나요?</h1>
              <p className="text-ink-soft text-sm mb-8">
                이메일을 입력하시면 재설정 링크를 보내드립니다.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-ink-soft mb-1.5">이메일</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-paper-raised border border-rule rounded-md px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
                  />
                </div>
                {error && (
                  <p className="text-sm text-seal bg-seal/5 border border-seal/30 rounded-md px-4 py-2.5">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-pen text-white font-semibold py-2.5 rounded-md text-sm hover:bg-pen-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  재설정 링크 보내기
                </button>
                <Link href="/auth/login" className="text-center text-sm text-ink-soft hover:text-ink transition-colors">
                  ← 로그인으로 돌아가기
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
      <AuthBrand />
    </div>
  )
}
