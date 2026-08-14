'use client'

/**
 * @파일: dashboard/settings/page.tsx
 * @설명: 설정 페이지 — 프로필(이름) 수정, 이메일 변경(확인 메일 방식), 비밀번호 변경(현재 비밀번호 검증)
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/common/Toast'
import { normalizeKoreanPhone, formatPhoneForDisplay } from '@/lib/phone'
import { isWrongPassword, isRateLimited } from '@/lib/auth-error'
import WithdrawSection from './WithdrawSection'
import EmailChangeSection from './EmailChangeSection'
import PageContainer from '@/components/common/PageContainer'
import { FormField, SubmitButton, inputCls } from './settings-ui'

export default function SettingsPage() {
  const supabase = createClient()
  const { showToast } = useToast()

  // 프로필
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  // 이메일 변경 확인 대기 주소 (auth.users.new_email — 확인 링크를 아직 안 누른 상태)
  const [pendingNewEmail, setPendingNewEmail] = useState<string | null>(null)

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
      setPendingNewEmail(data.user.new_email ?? null)
      supabase
        .from('profiles')
        .select('name, phone')
        .eq('id', data.user.id)
        .single()
        .then(({ data: profile }) => {
          setName(profile?.name ?? data.user!.user_metadata?.name ?? '')
          setPhone(
            formatPhoneForDisplay((profile as { phone?: string | null } | null)?.phone) ?? ''
          )
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

    // 전화번호 필수 + 형식 검증(정규화된 숫자만 저장)
    const normalizedPhone = normalizeKoreanPhone(phone)
    if (!normalizedPhone) {
      showToast('error', '올바른 휴대폰 번호를 입력해 주세요. (예: 010-1234-5678)')
      return
    }

    setProfileLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProfileLoading(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({ name, phone: normalizedPhone })
      .eq('id', user.id)

    if (error) {
      // 원문은 영문이라 화면에 내보내지 않는다. 사유는 브라우저 기록에만 남긴다.
      console.error('[settings] 프로필 저장 실패:', error.message)
      showToast('error', '프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      showToast('success', '프로필이 업데이트되었습니다.')
      // 저장된 정규화 값을 표시용 하이픈 표기로 반영
      setPhone(formatPhoneForDisplay(normalizedPhone))
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
      // 원인을 단정하지 않는다. 비밀번호가 틀린 경우와 그 외(요청 과다·연결 끊김)를 구분한다.
      // 판정은 lib/auth-error.ts 한 곳에 있고 로그인 화면도 같은 것을 쓴다.
      if (isWrongPassword(authError.message)) {
        setPasswordError('현재 비밀번호가 올바르지 않습니다.')
      } else if (isRateLimited(authError.message)) {
        setPasswordError('요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.')
      } else {
        // 원문은 영문이라 화면에 내보내지 않는다. 사유는 브라우저 기록에만 남긴다.
        console.error('[settings] 현재 비밀번호 확인 실패:', authError.message)
        setPasswordError('현재 비밀번호를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
      setPasswordLoading(false)
      return
    }

    // 새 비밀번호로 업데이트
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      // 원문은 영문이라 화면에 내보내지 않는다. 사유는 브라우저 기록에만 남긴다.
      console.error('[settings] 비밀번호 변경 실패:', error.message)
      showToast(
        'error',
        isRateLimited(error.message)
          ? '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
          : '비밀번호를 변경하지 못했습니다. 새 비밀번호를 확인한 뒤 다시 시도해 주세요.',
      )
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
      // 원문은 영문이라 화면에 내보내지 않는다. 사유는 브라우저 기록에만 남긴다.
      console.error('[settings] 수신 설정 저장 실패:', error.message)
      showToast('error', '수신 설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      showToast('success', next ? '수신 동의로 저장되었습니다.' : '수신을 거부했습니다.')
    }
    setMarketingLoading(false)
  }

  return (
    <PageContainer variant="dashboard">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink font-serif">설정</h1>
        <p className="text-ink-soft text-sm mt-1">계정 정보와 보안을 관리하세요.</p>
      </div>

      {/* 프로필 섹션 */}
      <section className="bg-paper-raised border border-rule rounded-card p-6 mb-6 max-w-2xl">
        <h2 className="text-base font-semibold text-ink mb-5">프로필</h2>
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

          <FormField label="휴대폰 번호">
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              required
              className={inputCls}
            />
            {phone.length > 0 && !normalizeKoreanPhone(phone) && (
              <p className="text-xs text-danger mt-1.5">
                숫자만 입력하거나 010-1234-5678 형식으로 입력해 주세요.
              </p>
            )}
          </FormField>

          <div className="flex justify-stretch sm:justify-end pt-1">
            <SubmitButton loading={profileLoading} label="변경사항 저장" />
          </div>
        </form>
      </section>

      {/* 이메일 변경 섹션 — 확인 메일 방식(인증 도구가 처리). 결제사 주소 한계 안내 포함 */}
      <EmailChangeSection currentEmail={email} pendingEmail={pendingNewEmail} />

      {/* 비밀번호 섹션 */}
      <section className="bg-paper-raised border border-rule rounded-card p-6 max-w-2xl mt-6">
        <h2 className="text-base font-semibold text-ink mb-5">비밀번호 변경</h2>
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
            <div className="flex items-center gap-2 text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-4 py-2.5">
              {passwordError}
            </div>
          )}

          <div className="flex justify-end">
            <SubmitButton loading={passwordLoading} label="비밀번호 변경" />
          </div>
        </form>
      </section>

      {/* 알림/마케팅 수신 동의 섹션 */}
      <section className="bg-paper-raised border border-rule rounded-card p-6 mt-6 max-w-2xl">
        <h2 className="text-base font-semibold text-ink mb-1.5">알림 수신 설정</h2>
        <p className="text-sm text-ink-soft mb-5">
          제품 업데이트·혜택 등 알림/마케팅 이메일 수신 여부를 선택하세요.
          <br className="hidden sm:block" />
          <span className="text-xs text-ink-faint">주문·결제·보안 등 필수 안내 메일은 이 설정과 무관하게 발송됩니다.</span>
        </p>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="marketing-opt-in" className="text-sm text-ink cursor-pointer">
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
              marketingOptIn ? 'bg-mark' : 'bg-paper-shade'
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
    </PageContainer>
  )
}

// 서브 컴포넌트(FormField·SubmitButton·inputCls)는 settings-ui.tsx로 이동 — 이메일 변경 섹션과 공유
