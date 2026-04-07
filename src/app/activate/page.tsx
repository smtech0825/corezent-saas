/**
 * @파일: app/activate/page.tsx
 * @설명: 라이선스 키 조회 및 활성화 페이지
 *        - 구매 후 이메일로 받은 시리얼 키를 입력하면 라이선스 정보를 확인합니다.
 *        - 로그인 사용자의 경우 본인 소유 여부를 검증합니다.
 */

import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ActivateClient from './ActivateClient'

export const metadata: Metadata = {
  title: 'Activate License — CoreZent',
  description: 'Enter your license key to verify and activate your CoreZent product.',
}

export default function ActivatePage() {
  return (
    <div className="min-h-screen bg-[#0B1120] font-sans flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <ActivateClient />
      </main>
      <Footer />
    </div>
  )
}
