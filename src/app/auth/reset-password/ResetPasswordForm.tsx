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
      setError('No account found with this email address.')
      setLoading(false)
      return
    }

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (err) {
      setError(err.message)
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0B1120] flex">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* 모바일 로고 */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl text-white">
              <span className="w-8 h-8 rounded-lg bg-[#38BDF8] flex items-center justify-center text-[#0B1120] font-black">C</span>
              CoreZent
            </Link>
          </div>

          {done ? (
            /* 발송 완료 */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Check your email</h1>
              <p className="text-[#94A3B8] text-sm leading-relaxed mb-6">
                We sent a password reset link to{' '}
                <span className="text-white font-medium">{email}</span>.
              </p>
              <Link href="/auth/login" className="text-sm text-[#38BDF8] hover:underline">
                ← Back to login
              </Link>
            </div>
          ) : (
            /* 이메일 입력 */
            <>
              <h1 className="text-2xl font-bold text-white mb-1">Forgot your password?</h1>
              <p className="text-[#94A3B8] text-sm mb-8">
                Enter your email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-[#111A2E] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#38BDF8] text-[#0B1120] font-semibold py-2.5 rounded-lg text-sm hover:bg-[#0ea5e9] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  Send reset link
                </button>
                <Link href="/auth/login" className="text-center text-sm text-[#94A3B8] hover:text-white transition-colors">
                  ← Back to login
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
