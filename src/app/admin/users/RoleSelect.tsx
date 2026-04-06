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
      className="bg-[#0B1120] border border-[#1E293B] text-[#94A3B8] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500/50 cursor-pointer"
    >
      <option value="user">user</option>
      <option value="admin">admin</option>
    </select>
  )
}
