/**
 * @파일: auth/update-password/page.tsx
 * @설명: 비밀번호 변경 페이지 — 이메일 재설정 링크 클릭 후 도달하는 페이지
 */

import type { Metadata } from 'next'
import UpdatePasswordForm from './UpdatePasswordForm'

export const metadata: Metadata = {
  title: '새 비밀번호 설정 — CoreZent',
}

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />
}
