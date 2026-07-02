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
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
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
      <div className="theme-paper min-h-screen bg-paper text-ink flex items-center justify-center">
        <Loader2 size={24} className="text-pen animate-spin" />
      </div>
    )
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
            /* 변경 완료 */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-pen/5 border border-pen/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} className="text-pen" />
              </div>
              <h1 className="text-2xl font-serif font-black text-ink mb-3">비밀번호가 변경되었습니다!</h1>
              <p className="text-ink-soft text-sm">
                로그인 페이지로 이동 중...
              </p>
            </div>
          ) : (
            /* 새 비밀번호 입력 */
            <>
              <h1 className="text-2xl font-serif font-black text-ink mb-1">새 비밀번호 설정</h1>
              <p className="text-ink-soft text-sm mb-8">
                계정에 사용할 새 비밀번호를 입력해 주세요.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                {/* 새 비밀번호 */}
                <div>
                  <label className="block text-sm text-ink-soft mb-1.5">새 비밀번호</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8자 이상 입력하세요"
                      required
                      minLength={8}
                      className="w-full bg-paper-raised border border-rule rounded-md px-4 py-2.5 pr-10 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-soft focus-visible:ring-2 focus-visible:ring-pen/40 rounded"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* 비밀번호 확인 */}
                <div>
                  <label className="block text-sm text-ink-soft mb-1.5">비밀번호 확인</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="새 비밀번호를 다시 입력하세요"
                      required
                      className="w-full bg-paper-raised border border-rule rounded-md px-4 py-2.5 pr-10 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-pen focus:ring-2 focus:ring-pen/15 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-soft focus-visible:ring-2 focus-visible:ring-pen/40 rounded"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
                  비밀번호 변경
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
