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
      showToast('success', 'Profile updated successfully.')
    }
    setProfileLoading(false)
  }

  // 비밀번호 변경 — 현재 비밀번호 먼저 검증
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (!currentPassword) {
      setPasswordError('Please enter your current password.')
      return
    }

    setPasswordLoading(true)

    // 현재 비밀번호 검증: 재로그인 시도
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (authError) {
      setPasswordError('The current password you entered is incorrect.')
      setPasswordLoading(false)
      return
    }

    // 새 비밀번호로 업데이트
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      showToast('error', error.message)
    } else {
      showToast('success', 'Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
    }
    setPasswordLoading(false)
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-[#94A3B8] text-sm mt-1">Manage your account details and security.</p>
      </div>

      {/* 프로필 섹션 */}
      <section className="bg-[#111A2E] border border-[#1E293B] rounded-xl p-6 mb-6">
        <h2 className="text-base font-semibold text-white mb-5">Profile</h2>
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <FormField label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </FormField>

          <FormField label="Email">
            <input
              type="email"
              value={email}
              disabled
              className={`${inputCls} opacity-50 cursor-not-allowed`}
            />
            <p className="text-xs text-[#475569] mt-1.5">Email cannot be changed here.</p>
          </FormField>

          <FormField label="Country">
            <CountrySelect
              value={country}
              onChange={setCountry}
              placeholder="Select your country"
            />
          </FormField>

          <div className="flex justify-end pt-1">
            <SubmitButton loading={profileLoading} label="Save changes" />
          </div>
        </form>
      </section>

      {/* 비밀번호 섹션 */}
      <section className="bg-[#111A2E] border border-[#1E293B] rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-5">Change Password</h2>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <FormField label="Current Password">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Your current password"
              required
              className={inputCls}
            />
          </FormField>

          <FormField label="New Password">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
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
            <SubmitButton loading={passwordLoading} label="Update password" />
          </div>
        </form>
      </section>
    </div>
  )
}

// ─── 서브 컴포넌트 ───────────────────────────────────────────

const inputCls = 'w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-[#38BDF8] transition-colors'

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
      className="bg-[#38BDF8] text-[#0B1120] font-semibold py-2 px-5 rounded-lg text-sm hover:bg-[#0ea5e9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {label}
    </button>
  )
}
