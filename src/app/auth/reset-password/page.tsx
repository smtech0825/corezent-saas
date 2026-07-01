import type { Metadata } from 'next'
import ResetPasswordForm from './ResetPasswordForm'

export const metadata: Metadata = {
  title: '비밀번호 재설정',
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
