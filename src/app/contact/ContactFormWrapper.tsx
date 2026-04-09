'use client'

/**
 * @컴포넌트: ContactFormWrapper
 * @설명: ContactForm을 ToastProvider로 감싸는 래퍼 (대시보드 외부에서 Toast 사용)
 */

import { ToastProvider } from '@/components/common/Toast'
import ContactForm from './ContactForm'

export default function ContactFormWrapper() {
  return (
    <ToastProvider>
      <ContactForm />
    </ToastProvider>
  )
}
