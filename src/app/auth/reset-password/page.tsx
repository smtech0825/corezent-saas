import type { Metadata } from 'next'
import ResetPasswordForm from './ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Reset password — CoreZent',
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
