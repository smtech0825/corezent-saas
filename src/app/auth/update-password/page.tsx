/**
 * @파일: auth/update-password/page.tsx
 * @설명: 비밀번호 변경 페이지 — 이메일 재설정 링크 클릭 후 도달하는 페이지
 */

import type { Metadata } from 'next'
import UpdatePasswordForm from './UpdatePasswordForm'

export const metadata: Metadata = {
  title: 'Set New Password',
}

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />
}
