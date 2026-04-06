'use client'

/**
 * @파일: dashboard/settings/page.tsx
 * @설명: 설정 페이지 — 프로필 수정, 비밀번호 변경
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()

  // 프로필
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 비밀번호
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 초기 로드
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setEmail(data.user.email ?? '')
      supabase
        .from('profiles')
        .select('name')
        .eq('id', data.user.id)
        .single()
        .then(({ data: profile }) => {
          setName(profile?.name ?? data.user.user_metadata?.name ?? '')
        })
    })
  }, [supabase])

  // 프로필 저장
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileLoading(true)
    setProfileMsg(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProfileLoading(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({ name })
      .eq('id', user.id)

    setProfileMsg(error
      ? { type: 'err', text: error.message }
      : { type: 'ok', text: 'Profile updated successfully.' }
    )
    setProfileLoading(false)
  }

  // 비밀번호 변경
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'err', text: 'Password must be at least 8 characters.' })
      return
    }
    setPasswordLoading(true)
    setPasswordMsg(null)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPasswordMsg({ type: 'err', text: error.message })
    } else {
      setPasswordMsg({ type: 'ok', text: 'Password updated successfully.' })
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

          <Feedback msg={profileMsg} />

          <div className="flex justify-end">
            <SubmitButton loading={profileLoading} label="Save changes" />
          </div>
        </form>
      </section>

      {/* 비밀번호 섹션 */}
      <section className="bg-[#111A2E] border border-[#1E293B] rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-5">Change Password</h2>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
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

          <Feedback msg={passwordMsg} />

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

function Feedback({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null
  return (
    <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border ${
      msg.type === 'ok'
        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        : 'text-red-400 bg-red-500/10 border-red-500/20'
    }`}>
      {msg.type === 'ok' && <CheckCircle size={14} />}
      {msg.text}
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
