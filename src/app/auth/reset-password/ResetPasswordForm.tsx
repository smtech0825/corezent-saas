'use client'

/**
 * @컴포넌트: ResetPasswordForm
 * @설명: 비밀번호 재설정 페이지
 *        1단계: 이메일 입력 → 재설정 링크 발송
 *        2단계: 링크 클릭 후 새 비밀번호 입력 (update 모드)
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthBrand from '../_components/AuthBrand'

export default function ResetPasswordForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'request' | 'update'>('request')

  // request 상태
  const [email, setEmail] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestDone, setRequestDone] = useState(false)
  const [requestError, setRequestError] = useState('')

  // update 상태
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateError, setUpdateError] = useState('')

  const supabase = createClient()

  // 이메일 링크에서 돌아왔을 때 update 모드로 전환
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update')
      }
    })
  }, [supabase])

  // 재설정 메일 발송
  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setRequestLoading(true)
    setRequestError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
    })

    if (error) {
      setRequestError(error.message)
    } else {
      setRequestDone(true)
    }
    setRequestLoading(false)
  }

  // 새 비밀번호 저장
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setUpdateError('Password must be at least 8 characters.')
      return
    }
    setUpdateLoading(true)
    setUpdateError('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setUpdateError(error.message)
      setUpdateLoading(false)
    } else {
      router.push('/dashboard')
    }
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

          {/* 메일 발송 완료 */}
          {requestDone ? (
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
          ) : mode === 'request' ? (
            /* 이메일 입력 단계 */
            <>
              <h1 className="text-2xl font-bold text-white mb-1">Forgot your password?</h1>
              <p className="text-[#94A3B8] text-sm mb-8">
                Enter your email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={handleRequest} className="flex flex-col gap-4">
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
                {requestError && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
                    {requestError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={requestLoading}
                  className="w-full bg-[#38BDF8] text-[#0B1120] font-semibold py-2.5 rounded-lg text-sm hover:bg-[#0ea5e9] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {requestLoading && <Loader2 size={15} className="animate-spin" />}
                  Send reset link
                </button>
                <Link href="/auth/login" className="text-center text-sm text-[#94A3B8] hover:text-white transition-colors">
                  ← Back to login
                </Link>
              </form>
            </>
          ) : (
            /* 새 비밀번호 입력 단계 */
            <>
              <h1 className="text-2xl font-bold text-white mb-1">Set new password</h1>
              <p className="text-[#94A3B8] text-sm mb-8">Enter your new password below.</p>
              <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                      className="w-full bg-[#111A2E] border border-[#1E293B] rounded-lg px-4 py-2.5 pr-10 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8]"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {updateError && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
                    {updateError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={updateLoading}
                  className="w-full bg-[#38BDF8] text-[#0B1120] font-semibold py-2.5 rounded-lg text-sm hover:bg-[#0ea5e9] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateLoading && <Loader2 size={15} className="animate-spin" />}
                  Update password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <AuthBrand />
    </div>
  )
}
