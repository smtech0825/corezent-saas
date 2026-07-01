'use client'

/**
 * @파일: dashboard/settings/page.tsx
 * @설명: 설정 페이지 — 프로필(이름+국가) 수정, 비밀번호 변경(현재 비밀번호 검증)
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle } from 'lucide-react'
import CountrySelect from '@/components/common/CountrySelect'
import { useToast } from '@/components/common/Toast'
import WithdrawSection from './WithdrawSection'

export default function SettingsPage() {
  const supabase = createClient()
  const { showToast } = useToast()

  // 프로필
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)

  // 비밀번호
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // 알림/마케팅 수신 동의 (profiles.marketing_opt_in — 마이그레이션 033)
  const [marketingOptIn, setMarketingOptIn] = useState(true)
  const [marketingLoading, setMarketingLoading] = useState(false)

  // 초기 로드
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setEmail(data.user.email ?? '')
      supabase
        .from('profiles')
        .select('name, country')
        .eq('id', data.user.id)
        .single()
        .then(({ data: profile }) => {
          setName(profile?.name ?? data.user!.user_metadata?.name ?? '')
          setCountry(profile?.country ?? '')
        })
      // 수신 동의는 별도 조회 — 컬럼(033) 미적용 상태에서도 프로필 로드가 깨지지 않도록 분리
      supabase
        .from('profiles')
        .select('marketing_opt_in')
        .eq('id', data.user.id)
        .single()
        .then(({ data: mk, error }) => {
          if (!error && mk) {
            setMarketingOptIn((mk as { marketing_opt_in: boolean | null }).marketing_opt_in ?? true)
          }
        })
    })
  }, [supabase])

  // 프로필 저장
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProfileLoading(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({ name, country })
      .eq('id', user.id)

    if (error) {
      showToast('error', error.message)
    } else {
      showToast('success', '프로필이 업데이트되었습니다.')
    }
    setProfileLoading(false)
  }

  // 비밀번호 변경 — 현재 비밀번호 먼저 검증
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')

    if (newPassword.length < 8) {
      setPasswordError('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (!currentPassword) {
      setPasswordError('현재 비밀번호를 입력해 주세요.')
      return
    }

    setPasswordLoading(true)

    // 현재 비밀번호 검증: 재로그인 시도
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (authError) {
      setPasswordError('현재 비밀번호가 올바르지 않습니다.')
      setPasswordLoading(false)
      return
    }

    // 새 비밀번호로 업데이트
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      showToast('error', error.message)
    } else {
      showToast('success', '비밀번호가 변경되었습니다.')
      setCurrentPassword('')
      setNewPassword('')
    }
    setPasswordLoading(false)
  }

  // 알림/마케팅 수신 동의 토글 저장 (본인 프로필 RLS 업데이트)
  async function handleToggleMarketing(next: boolean) {
    setMarketingOptIn(next)          // 낙관적 UI
    setMarketingLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMarketingLoading(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({ marketing_opt_in: next })
      .eq('id', user.id)

    if (error) {
      setMarketingOptIn(!next)       // 실패 시 원복
      showToast('error', '수신 설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      showToast('success', next ? '수신 동의로 저장되었습니다.' : '수신을 거부했습니다.')
    }
    setMarketingLoading(false)
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">설정</h1>
        <p className="text-[#94A3B8] text-sm mt-1">계정 정보와 보안을 관리하세요.</p>
      </div>

      {/* 프로필 섹션 */}
      <section className="bg-[#111A2E] border border-[#1E293B] rounded-xl p-6 mb-6">
        <h2 className="text-base font-semibold text-white mb-5">프로필</h2>
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <FormField label="이름">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </FormField>

          <FormField label="이메일">
            <input
              type="email"
              value={email}
              disabled
              className={`${inputCls} opacity-50 cursor-not-allowed`}
            />
            <p className="text-xs text-[#475569] mt-1.5">이메일은 여기서 변경할 수 없습니다.</p>
          </FormField>

          <FormField label="국가">
            <CountrySelect
              value={country}
              onChange={setCountry}
              placeholder="국가를 선택하세요"
            />
          </FormField>

          <div className="flex justify-stretch sm:justify-end pt-1">
            <SubmitButton loading={profileLoading} label="변경사항 저장" />
          </div>
        </form>
      </section>

      {/* 비밀번호 섹션 */}
      <section className="bg-[#111A2E] border border-[#1E293B] rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-5">비밀번호 변경</h2>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <FormField label="현재 비밀번호">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호"
              required
              className={inputCls}
            />
          </FormField>

          <FormField label="새 비밀번호">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8자 이상 입력하세요"
              required
              minLength={8}
              className={inputCls}
            />
          </FormField>

          {passwordError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
              {passwordError}
            </div>
          )}

          <div className="flex justify-end">
            <SubmitButton loading={passwordLoading} label="비밀번호 변경" />
          </div>
        </form>
      </section>

      {/* 알림/마케팅 수신 동의 섹션 */}
      <section className="bg-[#111A2E] border border-[#1E293B] rounded-xl p-6 mt-6">
        <h2 className="text-base font-semibold text-white mb-1.5">알림 수신 설정</h2>
        <p className="text-sm text-[#94A3B8] mb-5">
          제품 업데이트·혜택 등 알림/마케팅 이메일 수신 여부를 선택하세요.
          <br className="hidden sm:block" />
          <span className="text-xs text-[#475569]">주문·결제·보안 등 필수 안내 메일은 이 설정과 무관하게 발송됩니다.</span>
        </p>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="marketing-opt-in" className="text-sm text-white cursor-pointer">
            알림/마케팅 이메일 받기
          </label>
          <button
            id="marketing-opt-in"
            type="button"
            role="switch"
            aria-checked={marketingOptIn}
            disabled={marketingLoading}
            onClick={() => handleToggleMarketing(!marketingOptIn)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              marketingOptIn ? 'bg-[#38BDF8]' : 'bg-[#1E293B]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                marketingOptIn ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* 회원 탈퇴 섹션 (위험 구역) */}
      <WithdrawSection />
    </div>
  )
}

// ─── 서브 컴포넌트 ───────────────────────────────────────────

const inputCls = 'w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors'

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-[#94A3B8] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full sm:w-auto bg-[#38BDF8] text-[#0B1120] font-semibold py-3 sm:py-2 px-6 rounded-lg text-sm hover:bg-[#0ea5e9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {label}
    </button>
  )
}
