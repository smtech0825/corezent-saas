import type { Metadata } from 'next'
import RegisterForm from './RegisterForm'

export const metadata: Metadata = {
  title: 'Create account — CoreZent',
  description: 'Create your CoreZent account to get started.',
}

export default function RegisterPage() {
  return <RegisterForm />
}
