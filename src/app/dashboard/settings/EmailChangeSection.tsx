'use client'

/**
 * @컴포넌트: EmailChangeSection
 * @설명: 계정 이메일 변경 섹션 — 인증 도구(Supabase Auth)의 확인 메일 방식을 그대로 쓴다.
 *        새 주소로 확인 메일을 보내고, 메일의 링크를 눌러야 실제로 바뀐다(확인 없이 즉시 변경 없음).
 *        보안 설정(Secure email change)이 켜져 있으면 기존 주소로도 확인 메일이 가서
 *        계정을 빼앗겼을 때 알아챌 수 있다. 결제사(Lemon Squeezy)에 등록된 주소는
 *        우리가 바꿀 수 없으므로 그 한계를 화면에 밝힌다.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/common/Toast'
import { isEmailInUse, isRateLimited } from '@/lib/auth-error'
import { SITE_URL } from '@/lib/site'
import { FormField, SubmitButton, inputCls } from './settings-ui'

export default function EmailChangeSection({ currentEmail, pendingEmail }: {
  /** 지금 로그인에 쓰는 이메일 (auth.users.email) */
  currentEmail: string
  /** 확인 대기 중인 새 이메일 (auth.users.new_email — 확인 링크를 아직 안 누른 상태) */
  pendingEmail: string | null
}) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // 이번 화면에서 요청을 보낸 뒤의 대기 주소 — 서버 값(pendingEmail)과 합쳐 표시
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null)

  const waitingEmail = requestedEmail ?? pendingEmail

  /**
   * @함수명: handleSubmit
   * @설명: 새 주소로 확인 메일 발송을 요청합니다. 실제 변경은 손님이 메일의 링크를
   *        눌렀을 때 인증 도구가 처리합니다(우리 DB를 직접 바꾸지 않음).
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const next = newEmail.trim().toLowerCase()
    if (!next) { setError('새 이메일 주소를 입력해 주세요.'); return }
    if (next === currentEmail.trim().toLowerCase()) {
      setError('지금 쓰고 있는 주소와 같습니다. 다른 주소를 입력해 주세요.')
      return
    }

    setLoading(true)
    let updErr: { message: string; code?: string } | null = null
    try {
      const { error } = await supabase.auth.updateUser(
        { email: next },
        // 확인 링크를 누른 뒤 설정 화면으로 돌아온다 (가입 인증과 같은 콜백 경로).
        // 주소는 SITE_URL 단일 출처(폴백·www 정규화 포함)를 쓴다.
        { emailRedirectTo: `${SITE_URL}/auth/callback?redirect=${encodeURIComponent('/dashboard/settings')}` },
      )
      updErr = error
    } catch (err) {
      // 반환값이 아니라 예외로 터지는 경우도 폼이 영구 비활성화되지 않게 한다
      console.error('[settings] 이메일 변경 요청 예외:', err)
      updErr = { message: '' }
    }
    setLoading(false)

    if (updErr) {
      // 원문(영문)은 화면에 내보내지 않는다 — 판정은 lib/auth-error.ts 한 곳을 쓴다
      console.error('[settings] 이메일 변경 요청 실패:', updErr.message)
      if (isEmailInUse(updErr.message, updErr.code)) {
        setError('이미 사용 중인 주소라 바꿀 수 없습니다. 다른 주소를 입력해 주세요.')
      } else if (isRateLimited(updErr.message)) {
        setError('요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.')
      } else {
        setError('확인 메일을 보내지 못했습니다. 주소를 확인한 뒤 다시 시도해 주세요.')
      }
      return
    }

    setRequestedEmail(next)
    setNewEmail('')
    showToast('success', '확인 메일을 보냈습니다. 메일의 링크를 눌러야 변경이 완료됩니다.')
  }

  return (
    <section className="bg-paper-raised border border-rule rounded-card p-6 mt-6 max-w-2xl">
      <h2 className="text-base font-semibold text-ink mb-1.5">이메일 변경</h2>
      <p className="text-sm text-ink-soft mb-5">
        새 주소로 확인 메일을 보내드립니다. 메일의 링크를 눌러야 실제로 바뀝니다.
        보안 설정에 따라 지금 주소로도 확인 메일이 갈 수 있습니다.
        확인 링크는 <b className="text-ink">변경을 요청한 이 브라우저에서</b> 열어 주세요.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="현재 이메일">
          <input type="email" value={currentEmail} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
        </FormField>

        {waitingEmail && (
          <div className="text-sm text-caution bg-caution-soft border border-caution/20 rounded-lg px-4 py-2.5">
            <b>{waitingEmail}</b> 주소로 보낸 확인 메일의 링크를 아직 누르지 않았습니다.
            링크를 눌러야 변경이 완료됩니다.
          </div>
        )}

        <FormField label="새 이메일">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@example.com"
            required
            className={inputCls}
          />
        </FormField>

        {error && (
          <div role="alert" className="flex items-center gap-2 text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}

        <p className="text-xs text-ink-faint">
          결제 영수증·결제 안내 메일은 결제사(Lemon Squeezy)에 등록된 주소로 발송되며,
          여기서 바꿔도 결제사 쪽 주소는 바뀌지 않습니다. 결제사 주소는 결제 화면의
          &lsquo;결제수단 변경&rsquo;에서 열리는 관리 화면에서 바꿀 수 있습니다.
        </p>

        <div className="flex justify-end">
          <SubmitButton loading={loading} label="확인 메일 보내기" />
        </div>
      </form>
    </section>
  )
}
