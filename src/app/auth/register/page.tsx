import type { Metadata } from 'next'
import RegisterForm from './RegisterForm'

export const metadata: Metadata = {
  title: '회원가입',
  description: 'CoreZent 계정을 만들고 시작하세요.',
}

export default function RegisterPage() {
  return <RegisterForm />
}
