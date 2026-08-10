'use client'

/**
 * @컴포넌트: RoleSelect
 * @설명: 사용자 역할 변경 드롭다운 — 되돌리기 어려운 권한 변경이라 실행 전 재확인을 받는다.
 *        표시 값을 상태로 들고 있는 제어 컴포넌트다. 재확인에서 취소하면 상태를 바꾸지 않으므로
 *        React가 드롭다운 표시를 원래 값으로 되돌린다(화면만 바뀌고 실제는 안 바뀌는 어긋남 방지).
 */

import { useState } from 'react'

interface Props {
  userId: string
  /** 재확인 문구에 넣을 대상 표시(이메일). 없으면 일반 문구로 대체한다. */
  userEmail?: string
  currentRole: string
  onChange: (userId: string, role: string) => Promise<void>
}

const ROLE_LABEL: Record<string, string> = { admin: '관리자', user: '사용자' }

export default function RoleSelect({ userId, userEmail, currentRole, onChange }: Props) {
  const [role, setRole] = useState(currentRole)
  const [saving, setSaving] = useState(false)

  /**
   * @함수명: handleChange
   * @설명: 선택이 바뀌면 무엇이 일어나는지 알린 뒤 확인받고 실제 변경을 실행합니다.
   * @매개변수: e - select 변경 이벤트
   * @반환값: 없음
   */
  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    if (next === role) return

    const who = userEmail?.trim() || '이 사용자'
    const label = ROLE_LABEL[next] ?? next
    const effect = next === 'admin'
      ? '관리자는 모든 회원 정보·주문·라이선스를 조회하고 변경할 수 있습니다.'
      : '이 계정은 관리자 패널에 더 이상 접근할 수 없게 됩니다.'

    if (!confirm(`${who}의 권한을 "${label}"로 바꿀까요?\n\n${effect}`)) {
      // 상태를 바꾸지 않는다 → 제어 컴포넌트라 드롭다운이 원래 값으로 되돌아간다.
      return
    }

    const prev = role
    setSaving(true)
    setRole(next)
    try {
      await onChange(userId, next)
    } catch (err) {
      // 서버에서 실패하면 표시도 원래대로 되돌린다.
      setRole(prev)
      console.error('[RoleSelect] 역할 변경 실패:', err)
      alert('권한 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={role}
      onChange={handleChange}
      disabled={saving}
      className="bg-paper border border-rule text-ink-soft text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-mark cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <option value="user">사용자</option>
      <option value="admin">관리자</option>
    </select>
  )
}
