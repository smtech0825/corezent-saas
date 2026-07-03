'use client'

/**
 * @컴포넌트: RoleSelect
 * @설명: 사용자 역할 변경 드롭다운 — 변경 시 즉시 폼 제출
 */

interface Props {
  userId: string
  currentRole: string
  onChange: (userId: string, role: string) => Promise<void>
}

export default function RoleSelect({ userId, currentRole, onChange }: Props) {
  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await onChange(userId, e.target.value)
  }

  return (
    <select
      defaultValue={currentRole}
      onChange={handleChange}
      className="bg-paper border border-rule text-ink-soft text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-mark cursor-pointer"
    >
      <option value="user">사용자</option>
      <option value="admin">관리자</option>
    </select>
  )
}
