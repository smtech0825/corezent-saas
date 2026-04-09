'use client'

/**
 * @컴포넌트: UpdatePasswordForm
 * @설명: 새 비밀번호 입력 폼
 *        /auth/callback?type=recovery 처리 후 이 페이지로 리다이렉트됨
 *        세션이 이미 수립된 상태에서 auth.updateUser({ password })를 호출함
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthBrand from '../_components/AuthBrand'

export default function UpdatePasswordForm() {
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // 세션 확인 — recovery 세션 없으면 reset-password로 돌려보냄
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/reset-password')
      } else {
        setChecking(false)
      }
    })
  }, [router, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setDone(true)
      // recovery 세션 종료 후 로그인 페이지로 이동
      await supabase.auth.signOut()
      setTimeout(() => router.push('/auth/login'), 2000)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <Loader2 size={24} className="text-[#38BDF8] animate-spin" />
      </div>
    )
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
            /* 변경 완료 */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Password updated!</h1>
              <p className="text-[#94A3B8] text-sm">
                Redirecting to login…
              </p>
            </div>
          ) : (
            /* 새 비밀번호 입력 */
            <>
              <h1 className="text-2xl font-bold text-white mb-1">Set new password</h1>
              <p className="text-[#94A3B8] text-sm mb-8">
                Enter a new password for your account.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                {/* 새 비밀번호 */}
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

                {/* 비밀번호 확인 */}
                <div>
                  <label className="block text-sm text-[#94A3B8] mb-1.5">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your new password"
                      required
                      className="w-full bg-[#111A2E] border border-[#1E293B] rounded-lg px-4 py-2.5 pr-10 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8]"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
